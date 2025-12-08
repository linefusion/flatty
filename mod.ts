import * as fs from "@std/fs";
import * as path from "@std/path";
import * as flatbuffers from "./flatbuffers/mod.ts";
import * as metadata from "./metadata.ts";
import { log } from "./logger.ts";
import { Command } from "@cliffy/command";
import type { Schema } from "./flatbuffers/schema/parser.ts";
import * as generator from "./generator.ts";

export * from "./metadata.ts";
export type * from "./metadata.ts";

export * from "./generator.ts";
export type * from "./generator.ts";

export * from "./logger.ts";
export type * from "./logger.ts";

import * as std from "./std.ts";
import * as templates from "./templates.ts";

//import swc from "@swc/wasm";

import * as esbuild from "esbuild";
import { denoPlugins } from "esbuild_deno_loader";

//import { inspect } from "node:util";

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
      path.basename(schemaPath, ".fbs") + ".tsx",
      path.basename(schemaPath, ".fbs") + ".ts",
      path.basename(targetPath) + ".tsx",
      path.basename(targetPath) + ".ts",
      "*.tsx",
      "*.ts",
    ]).catch(() => undefined);
  } else if (targetInfo.isFile) {
    if (path.extname(targetPath) === ".fbs") {
      // Input is a schema file, try find .ts
      schemaPath = targetPath;
      generatorPath = await findOneFile(targetPath, [
        path.basename(schemaPath, ".fbs") + ".tsx",
        path.basename(schemaPath, ".fbs") + ".ts",
        path.basename(targetPath) + ".tsx",
        path.basename(targetPath) + ".ts",
        "*.tsx",
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
    } else if (path.extname(targetPath) === ".tsx") {
      // Input is a generator file, try find .fbs
      generatorPath = targetPath;
      schemaPath = await findOneFile(targetPath, [
        path.basename(generatorPath, ".tsx") + ".fbs",
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

async function findClosest(
  from: string,
  search: string,
): Promise<string | undefined> {
  if (!path.isAbsolute(from)) {
    from = path.resolve(from);
  }

  const parsed = path.parse(from);
  if (parsed.dir == parsed.root) {
    const value = path.join(from, search);
    if (await fs.exists(value)) {
      return value;
    }
    return;
  }

  if (!await fs.exists(path.join(from))) {
    return await findClosest(path.dirname(from), search);
  }

  const stat = await Deno.stat(from);
  if (stat.isFile) {
    from = path.dirname(from);
  }

  const candidate = path.join(from, search);
  if (await fs.exists(candidate)) {
    return candidate;
  }

  return findClosest(path.dirname(from), search);
}

/*
async function findClosestFileUrl(
  from: string,
  search: string,
): Promise<string | undefined> {
  const value = await findClosest(from, search);
  if (value) {
    return path.toFileUrl(value).toString();
  }
}
*/

const main = new Command()
  .name("flatty")
  .description("Flatty code generator")
  .version(metadata.VERSION)
  .option("-v, --verbose", "Verbose logging", {
    default: false,
  })
  .arguments("[path:string]")
  .action(async (_, input) => {
    const { generatorPath, schemaPath } = await inferFilesFromPath(
      input ?? ".",
    );

    let schema: Schema | undefined;

    const loadSchema = async (schemaPath: string): Promise<Schema> => {
      await using task = log.task("Parsing schema");

      return await flatbuffers.schema.parser.fromFile(schemaPath).then(
        (schema) => {
          return schema;
        },
      ).catch((error) => {
        task.error(error);
        throw error;
      });
    };

    const compileSchema = async (schemaPath: string, ...args: string[]) => {
      await using task = log.task(`Compiling schema`);

      return await flatbuffers.flatc.execute(schemaPath, ...args).then(
        (result) => {
          if (result.success) {
            return result.output;
          }

          throw new Error(result.output);
        },
      ).catch((error) => {
        task.error(error);
        throw error;
      });
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
      const paths = {
        denoJson: await findClosest(generatorPath, "deno.json"),
        denoLock: await findClosest(generatorPath, "deno.lock"),
        nodeModules: await findClosest(generatorPath, "node_modules"),
      };

      const result = await esbuild.build({
        entryPoints: [path.toFileUrl(generatorPath).toString()],
        plugins: [...denoPlugins({
          loader: "portable",
          configPath: paths.denoJson,
          lockPath: paths.denoLock,
          nodeModulesDir: "auto",
        }) as any],
        external: ["@linefusion/flatty"],
        sourcemap: true,
        bundle: true,
        write: false,
        format: "esm",
        target: "esnext",
      });

      if (result.errors.length > 0) {
        throw new Error(
          "Esbuild bundling failed: " + JSON.stringify(result.errors),
        );
      }

      const output = result.outputFiles[0].text;

      /*

      const swcOptions: swc.Options = {
        filename: generatorPath,
        jsc: {
          output: {
            charset: "utf8",
          },
          parser: {
            syntax: "typescript",
            decorators: true,
            dynamicImport: false,
            tsx: generatorPath.endsWith(".tsx"),
          },
          transform: {
            react: {
              runtime: "automatic",
              importSource: "react",
            },
          },
          target: "es2022",
        },
        module: {
          preserveImportMeta: true,
          allowTopLevelThis: false,
          type: "es6",
        },
      };

      const code: { code: string; diagnostics?: any[] } = <any> await swc
        .transform(await Deno.readTextFile(generatorPath), swcOptions);

      if (code.diagnostics?.length) {
        log.error().write(`error`);
        for (const diagnostic of code.diagnostics) {
          console.error(diagnostic);
        }
        throw new Error("Failed to load generator");
      }

      console.log(code.code);

      return;
      */
      const generate: any = await import(
        `data:text/javascript;base64,${btoa(output)}`
      );

      if (typeof generate.default !== "function") {
        throw new Error("Generator must have an exported default function");
      }

      return generate.default;
    }

    const loadingTask = log.task(
      `Loading generator "${path.basename(generatorPath)}"`,
    );

    const userGenerator = await loadGenerator(generatorPath);

    loadingTask.success();

    const generatingTask = log.task(
      `Running generator`,
    );

    await userGenerator({
      std,
      log,
      schema,

      inspect(value: unknown) {
        console.log(Deno.inspect(value, {
          colors: true,
          depth: 10000,
          showHidden: true,
          showProxy: true,
          sorted: true,
        }));
      },

      templates,

      error: generator.error,

      flatbuffers: {
        loadSchema,
        compileSchema,
      },
    });

    generatingTask.success();
  });

export async function run() {
  try {
    await main.parse(Deno.args);
  } catch (err) {
    if (!(err instanceof Error)) {
      throw new Error("Unknown error", { cause: err });
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
  // Cannot be awaited, hangs because of module loading
  run()
    .catch((err) => {
      log.error("Flatty failed to run").line();
      log.error("ERROR:").line();
      console.error(Deno.inspect(err, { colors: true }));
      Deno.exit(1);
    });
}
