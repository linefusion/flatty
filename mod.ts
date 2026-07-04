import { log } from "./logger.ts";

// Failures that escape the normal flow must still be reported and must
// fail the process: build tools rely on the exit code, and the default
// handlers would race against pending work.
globalThis.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  log.exception(event.reason);
  log.error("Flatty failed (unhandled promise rejection)");
  Deno.exit(1);
});

globalThis.addEventListener("error", (event) => {
  event.preventDefault();
  log.exception(event.error ?? event.message);
  log.error("Flatty failed (uncaught exception)");
  Deno.exit(1);
});

import { Command } from "@cliffy/command";

import { encodeBase64 } from "@std/encoding/base64";
import * as fs from "@std/fs";
import * as path from "@std/path";
import * as flatbuffers from "./flatbuffers/mod.ts";
import * as metadata from "./metadata.ts";
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

import swc from "@swc/wasm";

//import deno from "./deno.json" with { type: "json" };
//import $ from "@david/dax";
//const externals = Object.keys(deno.imports);

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

/*
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
  .action(async (options, input) => {
    log.verbose = !!options.verbose;

    const { generatorPath, schemaPath } = await inferFilesFromPath(
      input ?? ".",
    );

    log.debug(`schema: ${schemaPath ?? "(none)"}`);
    log.debug(`generator: ${generatorPath ?? "(none)"}`);

    let schema: Schema | undefined;

    const loadSchema = async (schemaPath: string): Promise<Schema> => {
      await using task = log.task(
        `Parsing schema "${path.basename(schemaPath)}"`,
      );

      try {
        return await flatbuffers.schema.parser.fromFile(schemaPath);
      } catch (error) {
        task.error(error);
        throw error;
      }
    };

    const compileSchema = async (
      targetSchema?: string,
      ...args: string[]
    ): Promise<void> => {
      targetSchema = targetSchema ?? schemaPath;

      await using task = log.task(
        `Compiling flatbuffers schema: ${targetSchema}.`,
      );

      const result = await flatbuffers.flatc.execute(...args, targetSchema);
      if (!result.success) {
        const error = new flatbuffers.flatc.FlatcError(
          result,
          `Failed to compile:`,
        );
        task.error(error);
        throw error;
      }
    };

    // Load generator
    const loadGenerator = async (generatorPath: string) => {
      await using task = log.task(
        `Loading generator "${path.basename(generatorPath)}"`,
      );

      try {
        /*
        const paths = {
          denoJson: await findClosest(generatorPath, "deno.json"),
          denoLock: await findClosest(generatorPath, "deno.lock"),
          nodeModules: await findClosest(generatorPath, "node_modules"),
        };
        */

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

        let code: { code: string; diagnostics?: any[] };
        try {
          code = <any> await swc.transform(
            await Deno.readTextFile(generatorPath),
            swcOptions,
          );
        } catch (cause) {
          // swc reports syntax errors by throwing (often a plain string
          // with the formatted diagnostic); keep it as the cause so it is
          // rendered in full.
          throw new Error(
            `Failed to transform generator ${JSON.stringify(generatorPath)}`,
            { cause },
          );
        }

        if (code.diagnostics?.length) {
          for (const diagnostic of code.diagnostics) {
            log.error(diagnostic);
          }
          throw new Error(
            `Failed to transform generator ${
              JSON.stringify(generatorPath)
            }: ${code.diagnostics.length} diagnostic(s) reported above`,
          );
        }

        const output = code.code;

        /*
        const externalArgs = externals.flatMap((name) => ["--external", name]);

        const output = Array.from(
          new TextEncoder().encode(
            await $`deno bundle --format esm --packages=external ${externalArgs} ${generatorPath}`
              .text(),
          ),
        ).reduce((acc, byte) => {
          acc += String.fromCharCode(byte);
          return acc;
        }, "");

        console.log(output);
        */

        let generate: any;
        try {
          // encodeBase64 handles the full UTF-8 range; btoa() would throw
          // on any non-Latin1 character in the generator source.
          generate = await import(
            `data:text/typescript;base64,${encodeBase64(output)}`
          );
        } catch (error) {
          // Errors from a data: URL import embed the whole base64 module
          // in the message; swap it for the actual file path.
          const message = (error instanceof Error ? error.message : `${error}`)
            .replaceAll(
              /data:text\/typescript;base64,[A-Za-z0-9+/=.]+/g,
              JSON.stringify(generatorPath),
            );
          throw new Error(`Failed to load generator: ${message}`);
        }

        if (typeof generate.default !== "function") {
          throw new Error(
            `Generator ${
              JSON.stringify(generatorPath)
            } must export a default function (see the "generator" helper)`,
          );
        }

        return generate.default;
      } catch (error) {
        const wrapped = error instanceof Error ? error : new Error(
          `Failed to load generator ${JSON.stringify(generatorPath)}`,
          { cause: error },
        );
        task.error(wrapped);
        throw wrapped;
      }
    };

    const generate = async (userGenerator: generator.Generator) => {
      await using task = log.task(
        `Running generator`,
      );

      try {
        await userGenerator({
          std,
          log,
          schema,
          inspect(value: unknown) {
            log.inspect(value);
          },
          templates,
          error: generator.error,
          flatbuffers: {
            loadSchema,
            compileSchema,
          },
        });
      } catch (error) {
        const wrapped = error instanceof Error
          ? error
          : new Error("Generator failed", { cause: error });
        // The generator module runs from a data: URL; point stack frames
        // back at the real file so they are readable. V8 abbreviates long
        // specifiers with "......", hence the dots in the pattern.
        if (wrapped.stack) {
          wrapped.stack = wrapped.stack.replaceAll(
            /data:text\/typescript;base64,[A-Za-z0-9+/=.]+/g,
            path.toFileUrl(generatorPath!).toString(),
          );
        }
        task.error(wrapped);
        throw wrapped;
      }
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

    const userGenerator = await loadGenerator(generatorPath);

    await generate(userGenerator);

    log.success("Generation completed successfully");
  });

/**
 * Runs the CLI.
 *
 * @returns Whether the run succeeded. Errors are fully reported here; the
 * caller only needs to translate the result into an exit code.
 */
export async function run(): Promise<boolean> {
  try {
    await main.parse(Deno.args);
    return true;
  } catch (err) {
    // No-op for errors a task already rendered; anything else (argument
    // parsing, file discovery, ...) is rendered here.
    log.exception(err);
    log.error("Flatty failed");
    return false;
  }
}

if (import.meta.main) {
  // Cannot be awaited at the top level (pending module work keeps the event
  // loop alive), so exit explicitly. All logging is synchronous and flushed
  // by the time these callbacks run — nothing is lost by exiting here.
  run()
    .then((success) => {
      Deno.exit(success ? 0 : 1);
    })
    .catch((err) => {
      log.exception(err);
      log.error("Flatty failed");
      Deno.exit(1);
    });
}
