import * as fs from "jsr:@std/fs@1.0.15";
import * as path from "jsr:@std/path@1.0.8";
import * as colors from "jsr:@std/fmt@1.0.6/colors";
import * as flatbuffers from "./flatbuffers/mod.ts";

import * as vento from "jsr:@vento/vento@1.12.16";
import * as eta from "jsr:@eta-dev/eta@3.5.0";

import { Command } from "jsr:@cliffy/command@1.0.0-rc.7";
import { unindent } from "./strings/mod.ts";

import type { Schema } from "./flatbuffers/schema/parser.ts";

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

export interface ILogger {
  line(): ILogger;
  newline(): ILogger;
  write(message?: unknown): ILogger;
  neutral(message?: unknown): ILogger;
  details(message?: unknown): ILogger;
  info(message?: unknown): ILogger;
  success(message?: unknown): ILogger;
  warn(message?: unknown): ILogger;
  error(message?: unknown): ILogger;
}

export class LoggerScope implements ILogger, Disposable, AsyncDisposable {
  constructor(private readonly logger: Logger) {
    this.logger.push();
  }

  [Symbol.dispose]() {
    this.logger.pop();
  }

  [Symbol.asyncDispose]() {
    this.logger.pop();
    return Promise.resolve();
  }

  line(): ILogger {
    this.logger.line();
    return this;
  }

  newline(): ILogger {
    this.logger.newline();
    return this;
  }

  write(message?: unknown): ILogger {
    this.logger.write(message);
    return this;
  }

  neutral(message?: unknown): ILogger {
    this.logger.neutral(message);
    return this;
  }

  details(message?: unknown): ILogger {
    this.logger.details(message);
    return this;
  }

  info(message?: unknown): ILogger {
    this.logger.info(message);
    return this;
  }

  success(message?: unknown): ILogger {
    this.logger.success(message);
    return this;
  }

  warn(message?: unknown): ILogger {
    this.logger.warn(message);
    return this;
  }

  error(message?: unknown): ILogger {
    this.logger.error(message);
    return this;
  }
}

export class Logger implements ILogger {
  private last: (str: string) => string = colors.gray;
  private readonly text: TextEncoder = new TextEncoder();
  private level: number = 0;

  private readonly writer = Deno.stderr;

  tap(callback: (this: Logger, log: Logger) => void) {
    callback.apply(log, [log]);
    return this;
  }

  push() {
    this.level++;
    this.line();
    return this;
  }

  pop() {
    this.level--;
    this.line();
    return this;
  }

  async scope(
    callback?: (this: LoggerScope, log: LoggerScope) => void | Promise<void>,
  ): Promise<LoggerScope> {
    const logger = new LoggerScope(this);
    if (callback) {
      await callback.apply(logger, [logger]);
    }

    return logger;
  }

  write(message?: unknown): this {
    if (!message) {
      return this;
    }

    if (typeof message !== "string") {
      message = Deno.inspect(message, { colors: true });
    }

    const lines = unindent(message as string).replaceAll(
      /\n/g,
      "\n" + "  ".repeat(this.level),
    );

    this.writer.write(this.text.encode(this.last(lines)));
    return this;
  }

  line(): this {
    this.last = colors.reset;
    return this.write("\n");
  }

  newline(): this {
    this.last = colors.reset;
    return this.write("\n");
  }

  neutral(message?: unknown): this {
    this.last = colors.white;
    return this.write(message);
  }

  details(message?: unknown): this {
    this.last = colors.gray;
    return this.write(message);
  }

  info(message?: unknown): this {
    this.last = colors.blue;
    return this.write(message);
  }

  success(message?: unknown): this {
    this.last = colors.green;
    return this.write(message);
  }

  warn(message?: unknown): this {
    this.last = colors.yellow;
    return this.write(message);
  }

  error(message?: unknown): this {
    this.last = colors.brightRed;
    return this.write(message);
  }
}

export const log: Logger = new Logger();

export type Generator = (options: {
  schema?: flatbuffers.schema.parser.Schema;
  error: (message: string) => never;
  log: typeof log;
  loadSchema: (schemaPath: string) => Promise<Schema>;
  templating: {
    eta: typeof eta;
    vento: typeof vento;
  };
}) => Promise<unknown>;

export function generator(impl: Generator): Generator {
  return impl;
}

export class GeneratorError extends Error {
}

export function error(message: string): never {
  throw new GeneratorError(message);
}

const main = new Command()
  .arguments("[path:string]")
  .action(async (_, input) => {
    const { generatorPath, schemaPath } = await inferFilesFromPath(
      input ?? ".",
    );

    let schema: Schema | undefined;

    const loadSchema = async (schemaPath: string): Promise<Schema> => {
      log.neutral(`Parsing schema... `);
      return await flatbuffers.schema.parser.fromFile(schemaPath).then(
        (schema) => {
          log.success().write(`success`);
          return schema;
        },
      ).catch((err) => {
        log.error().write(`error`);
        throw err;
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
    const generate = await import("file://" + generatorPath);
    if (typeof generate.default !== "function") {
      throw new Error("Generator must have an exported default function");
    }

    log.line().neutral(`Running generator... `);

    await generate.default({
      log,
      schema,

      templating: {
        eta,
        vento,
      },

      error,
      loadSchema,
    });

    log.success().write(`success`);
    log.line();
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
