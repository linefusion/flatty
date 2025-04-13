import * as colors from "jsr:@std/fmt@1.0.6/colors";

import { unindent } from "./strings/mod.ts";

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

export interface LoggerTask {
  success(): void;
  error(): void;
}

export class LoggerScope implements ILogger, Disposable, AsyncDisposable {
  constructor(private readonly logger: Logger) {
    this.logger.push();
  }

  [Symbol.dispose]() {
    this.logger.pop();
  }

  [Symbol.asyncDispose](): Promise<void> {
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

  tap(callback: (this: Logger, log: Logger) => void): this {
    callback.apply(log, [log]);
    return this;
  }

  push(): this {
    this.level++;
    this.line();
    return this;
  }

  pop(): this {
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

    const lineCount = (message as string).split("\n").length;

    const lines =
      (lineCount > 1 ? unindent(message as string) : message as string)
        .replaceAll(
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

  task(name: string): LoggerTask {
    const start = performance.now();

    this.neutral(`${name}...`).line();
    return {
      success: () => {
        const duration = (performance.now() - start).toFixed(2);
        this
          .neutral(`${name}... `).success("success").details(` (${duration}ms)`)
          .line();
      },
      error: () => {
        const duration = (performance.now() - start).toFixed(2);
        this
          .neutral(`${name}... `).error("error").details(` (${duration}ms)`)
          .line();
      },
    };
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
