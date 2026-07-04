import * as colors from "@std/fmt/colors";

import { unindent } from "@linefusion/strings";

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

export interface LoggerTask extends AsyncDisposable, Disposable {
  success(): void;
  error(reason?: Error | unknown): void;
  [Symbol.dispose](): void;
  [Symbol.asyncDispose](): PromiseLike<void>;
}

/**
 * Errors that have already been rendered to the user. Lets the top-level
 * handler print errors exactly once, no matter how many task/catch layers
 * they bubble through.
 */
const reportedErrors = new WeakSet<object>();

function markReported(error: unknown) {
  if (typeof error === "object" && error !== null) {
    reportedErrors.add(error);
  }
}

export function wasReported(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    reportedErrors.has(error);
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

  debug(message?: unknown): ILogger {
    this.logger.debug(message);
    return this;
  }

  exception(error: unknown): ILogger {
    this.logger.exception(error);
    return this;
  }

  inspect(value?: unknown): ILogger {
    this.logger.inspect(value);
    return this;
  }
}

export class Logger implements ILogger {
  private colorizer: (str: string) => string = colors.gray;
  private readonly text: TextEncoder = new TextEncoder();
  private level: number = 0;
  private readonly writer = Deno.stderr;

  /**
   * When enabled, errors include stack traces and executed commands are
   * logged. Toggled by the CLI `--verbose` flag.
   */
  verbose: boolean = false;

  /**
   * Writes bytes synchronously and completely. Logging must never race
   * against `Deno.exit()`: async writes that are still queued when the
   * process exits are silently dropped, which loses error output.
   */
  private writeBytes(bytes: Uint8Array): void {
    try {
      let written = 0;
      while (written < bytes.length) {
        written += this.writer.writeSync(bytes.subarray(written));
      }
    } catch {
      // stderr is closed or broken; there is nowhere left to report to.
    }
  }

  inspect(value?: unknown): void {
    this.newline();
    this.writeBytes(this.text.encode("\n"));
    this.writeBytes(
      this.text.encode(Deno.inspect(value, {
        colors: true,
        depth: 10000,
        showHidden: true,
        showProxy: true,
        sorted: true,
      })),
    );
    this.writeBytes(this.text.encode("\n"));
  }

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
    // Only skip absent values: empty strings, `0` and `false` are still
    // meaningful output (an error with an empty message must not vanish).
    if (message === undefined || message === null || message === "") {
      return this;
    }

    if (typeof message !== "string") {
      message = Deno.inspect(message, { colors: true });
    }

    const lineCount = (message as string).split("\n").length;

    let lines =
      (lineCount > 1 ? unindent(message as string) : message as string)
        .replaceAll(
          /\n/g,
          "\n" + "  ".repeat(this.level),
        );

    if (message == "\n") {
      lines = "\n";
    }

    this.writeBytes(this.text.encode(this.colorizer(lines)));

    return this;
  }

  line(): this {
    this.colorizer = colors.reset;
    return this.write("\n");
  }

  newline(): this {
    this.colorizer = colors.reset;
    return this.write("\n");
  }

  task(name: string): LoggerTask {
    const taskInstance = {
      finished: false,
      duration: "",
      logger: this,
      [Symbol.dispose]() {
        this.success();
      },
      [Symbol.asyncDispose]() {
        this.success();
        return Promise.resolve();
      },
      success() {
        if (this.finished) {
          return;
        }
        this.finished = true;
        this.duration = (performance.now() - start).toFixed(2);
        this.logger
          .neutral(
            `${name}... ${colors.green("success")} ${
              colors.gray(`(${this.duration}ms)`)
            }`,
          );
      },
      error(err: Error | unknown) {
        if (this.finished) {
          return;
        }
        this.finished = true;
        this.duration = (performance.now() - start).toFixed(2);
        this.logger
          .neutral(
            `${name}... ${colors.red("failed")} ${
              colors.gray(`(${this.duration}ms)`)
            }`,
          );
        if (err !== undefined) {
          this.logger.exception(err);
        }
      },
    };

    this.neutral(`${name}...`);

    const start = performance.now();
    return taskInstance;
  }

  neutral(message?: unknown): this {
    this.colorizer = colors.white;
    return this.write(message).newline();
  }

  details(message?: unknown): this {
    this.colorizer = colors.gray;
    return this.write(message).newline();
  }

  info(message?: unknown): this {
    this.colorizer = colors.blue;
    return this.write(message).newline();
  }

  success(message?: unknown): this {
    this.colorizer = colors.green;
    return this.write(message).newline();
  }

  warn(message?: unknown): this {
    this.colorizer = colors.yellow;
    return this.write(message).newline();
  }

  error(message?: unknown): this {
    this.colorizer = colors.brightRed;
    return this.write(message).newline();
  }

  debug(message?: unknown): this {
    if (!this.verbose) {
      return this;
    }
    this.colorizer = colors.magenta;
    return this.write(message).newline();
  }

  /**
   * Renders an error (message, cause chain and, in verbose mode, stack
   * traces) exactly once: re-rendering the same error object is a no-op, so
   * every layer that sees an error can safely report it without spamming
   * the user with duplicates.
   */
  exception(error: unknown): this {
    if (wasReported(error)) {
      return this;
    }
    markReported(error);

    if (!(error instanceof Error)) {
      this.error(
        typeof error === "string"
          ? error
          : Deno.inspect(error, { colors: true, depth: 10 }),
      );
      return this;
    }

    const message = error.message.replace(/^\s*\n+/, "").trimEnd();
    if (message) {
      this.error(message);
    } else {
      this.error(`${error.name} (no message)`);
    }

    if (this.verbose && error.stack) {
      const stack = error.stack.split("\n")
        .filter((line) => /^\s*at\s/.test(line))
        // Collapse inline module sources (data: URLs) that would otherwise
        // fill the screen with base64.
        .map((line) =>
          line.trim().replace(
            /data:[^;,)\s]+;base64,[A-Za-z0-9+/=.]{24,}/g,
            "data:<inline module>",
          )
        )
        .join("\n");
      if (stack) {
        this.details(stack);
      }
    } else if (!this.verbose) {
      this.details("(run with --verbose for stack traces)");
    }

    if (error.cause !== undefined && error.cause !== null) {
      this.details("caused by:");
      this.push();
      try {
        this.exception(error.cause);
      } finally {
        this.pop();
      }
    }

    return this;
  }
}

export const log: Logger = new Logger();
