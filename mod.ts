import * as fs from "jsr:@std/fs@1.0.15";
import * as path from "jsr:@std/path@1.0.8";
import * as flatbuffers from "./flatbuffers/mod.ts";
import * as vento from "jsr:@vento/vento@1.12.16";
import * as eta from "jsr:@eta-dev/eta@3.5.0";
import * as metadata from "./metadata.ts";
import { log } from "./logger.ts";
import { Command } from "jsr:@cliffy/command@1.0.0-rc.7";
import type { Schema } from "./flatbuffers/schema/parser.ts";
import * as generator from "./generator.ts";
export * from "./metadata.ts";
export type * from "./metadata.ts";
export * from "./generator.ts";
export type * from "./generator.ts";
export * from "./logger.ts";
export type * from "./logger.ts";
import * as std from "./std.ts";

import swc from "npm:@swc/wasm@1.11.20";

/**
 * Finds exactly one file from a given root directory.
 *
 * @param root The root directory
 * @param pattern A single or multiple patterns to search for.
 *
 * @returns The file found.
 */
async function findOneFile(root: string, pattern: string | string[]) {
  root = path.resolve(root);
  const patterns = Array.isArray(pattern) ? pattern : [pattern];

  let error: string | null = null;
  for (const pattern of patterns) {
    const files = await Array.fromAsync(fs.expandGlob(pattern, {
      root,
      includeDirs: true,
      canonicalize: true,
    }));

    if (files.length === 0) {
      error = `Could not find files ${JSON.stringify(pattern)} in ${
        JSON.stringify(root)
      }`;
      continue;
    } else if (files.length > 1) {
      error = `Multiple files ${JSON.stringify(pattern)} found in ${
        JSON.stringify(root)
      }`;
      continue;
    }

    return files[0].path;
  }

  throw new Error(error ?? "File not found");
}

/**
 * Infer project files from a given path.
 *
 * @param value Path to infer files from.
 * @returns Both schema and generator file paths.
 */
async function inferFilesFromPath(value: string) {
  const targetPath = path.resolve(value);
  if (!(await fs.exists(targetPath))) {
    throw new Error("Not found: " + targetPath);
  }

  let schemaPath: string | undefined;
  let generatorPath: string | undefined;

  async function isFile(path?: string) {
    try {
      if (!path) {
        return false;
      }
      return (await Deno.stat(path)).isFile;
    } catch (_) {
      return false;
    }
  }

  const targetInfo = await Deno.stat(targetPath);

  if (targetInfo.isDirectory) {
    // Input is a directory, try find schema.fbs + schema.ts
    schemaPath = await findOneFile(targetPath, [
      "schema.fbs",
      path.basename(targetPath) + ".fbs",
      "*.fbs",
    ]);
    generatorPath = await findOneFile(targetPath, [
      path.basename(schemaPath, ".fbs") + ".ts",
      path.basename(targetPath) + ".ts",
      "*.ts",
    ]).catch(() => undefined);
  } else if (targetInfo.isFile) {
    if (path.extname(targetPath) === ".fbs") {
      // Input is a schema file, try find .ts
      schemaPath = targetPath;
      generatorPath = await findOneFile(targetPath, [
        path.basename(schemaPath, ".fbs") + ".ts",
        path.basename(targetPath) + ".ts",
        "*.ts",
      ]).catch(() => undefined);
    } else if (path.extname(targetPath) === ".ts") {
      // Input is a generator file, try find .fbs
      generatorPath = targetPath;
      schemaPath = await findOneFile(targetPath, [
        path.basename(generatorPath, ".ts") + ".fbs",
        path.basename(targetPath) + ".fbs",
        "*.fbs",
      ]);
    } else {
      // Everything failed
      throw new Error("Unsupported file: " + targetPath);
    }
  } else {
    throw new Error("Unknown type: " + targetPath);
  }

  if (!(await isFile(schemaPath)) && !(await isFile(generatorPath))) {
    throw new Error("Could not find schema or generator file");
  }

  return {
    schemaPath,
    generatorPath,
  };
}

const main = new Command()
  .name("flatty")
  .description("Flatty code generator")
  .version(metadata.VERSION)
  .arguments("[path:string]")
  .action(async (_, input) => {
    const { generatorPath, schemaPath } = await inferFilesFromPath(
      input ?? ".",
    );

    let schema: Schema | undefined;

    const loadSchema = async (schemaPath: string): Promise<Schema> => {
      const parseTask = log.task("Parsing schema");

      return await flatbuffers.schema.parser.fromFile(schemaPath).then(
        (schema) => {
          parseTask.success();
          return schema;
        },
      ).catch((err) => {
        parseTask.error();
        throw err;
      });
    };

    const compileSchema = async (schemaPath: string, ...args: string[]) => {
      const compileTask = log.task(`Compiling schema`);

      return await flatbuffers.flatc.execute(schemaPath, ...args).then(
        (result) => {
          if (result.success) {
            compileTask.success();
            return result.output;
          }

          compileTask.error();
          throw new Error(result.output);
        },
      );
    };

    if (schemaPath) {
      schema = await loadSchema(schemaPath);
    }

    // Schema but no generator -> dump parsed schema as JSON
    if (!generatorPath && schema) {
      console.log(JSON.stringify(schema, null, 2));
      return;
    }

    // No schema and no generator -> error
    if (!generatorPath) {
      throw new Error("No generator file found");
    }

    // Load generator

    async function loadGenerator(generatorPath: string) {
      const code: { code: string; diagnostics?: any[] } = <any> await swc
        .transform(
          await Deno.readTextFile(generatorPath),
          {
            filename: "meh.ts",
            jsc: {
              parser: {
                syntax: "typescript",
                tsx: false,
              },
              target: "es2022",
            },
            module: {
              type: "es6",
            },
          },
        );

      if (code.diagnostics?.length) {
        log.error().write(`error`);
        for (const diagnostic of code.diagnostics) {
          console.error(diagnostic);
        }
        throw new Error("Failed to load generator");
      }

      const generate: any = await import(
        `data:text/javascript;base64,${btoa(code.code)}`
      );

      if (typeof generate.default !== "function") {
        throw new Error("Generator must have an exported default function");
      }

      return generate.default;
    }

    const generateTask = log.task("Running generator");

    const generate = await loadGenerator(generatorPath);
    await generate({
      std,
      log,
      schema,

      templating: {
        eta,
        vento,
      },

      error: generator.error,

      flatbuffers: {
        loadSchema,
        compileSchema,
      },
    });

    generateTask.success();
  });

export async function run() {
  try {
    await main.parse(Deno.args);
  } catch (err) {
    if (!(err instanceof Error)) {
      Deno.exit(1);
    }

    await log.scope((logger) => {
      logger.error(`
        ${err?.message ?? "Unknown error"}
      `);
    });

    await log.scope((logger) => {
      logger.details(Deno.inspect(err, { colors: true }));
    });
  }
}

if (import.meta.main) {
  run().catch((err) => {
    console.error(err);
    Deno.exit(1);
  });
}
