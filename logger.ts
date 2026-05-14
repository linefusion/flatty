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

  inspect(value?: unknown): void {
    this.newline();
    this.writer.write(this.text.encode("\n"));
    this.writer.write(
      this.text.encode(Deno.inspect(value, {
        colors: true,
        depth: 10000,
        showHidden: true,
        showProxy: true,
        sorted: true,
      })),
    );
    this.writer.write(this.text.encode("\n"));
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
    if (!message) {
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

    if (this.writer && this.writer.writable) {
      this.writer.write(this.text.encode(this.colorizer(lines)));
    }

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
        if (err instanceof Error) {
          this.logger
            .error(err.message)
            .details(err);
        } else {
          this.logger.error(err);
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
    this.colorizer = colors.magenta;
    return this.write(message).newline();
  }
}

export const log: Logger = new Logger();
