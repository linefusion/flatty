import { $ } from "@david/dax";

import { log } from "../logger.ts";

/**
 * Result of a flatc invocation, including everything needed to report a
 * failure to the user.
 */
export interface FlatcResult {
  success: boolean;
  code: number;
  command: string;
  stdout: string;
  stderr: string;
}

/**
 * Raised when flatc exits with a non-zero status. Carries the full command
 * and output so the compiler diagnostics (syntax errors, missing includes,
 * ...) reach the user verbatim.
 */
export class FlatcError extends Error {
  constructor(public readonly result: FlatcResult, context?: string) {
    const output = [result.stderr, result.stdout]
      .map((text) => text.trim())
      .filter((text) => text.length > 0)
      .join("\n");

    super(
      [
        context ?? `flatc exited with code ${result.code}`,
        output.length > 0 ? output : "(flatc produced no output)",
      ].join("\n"),
    );
    this.name = "FlatcError";
  }
}

export async function isInstalled(): Promise<boolean> {
  try {
    return await $.which("flatc") !== undefined;
  } catch (_) {
    return false;
  }
}

export async function version(): Promise<string | undefined> {
  try {
    const version = await $`flatc --version`.quiet().text();
    return version.replace(/flatc version /gm, "").trim();
  } catch (_) {
    return undefined;
  }
}

export async function assert(semver?: string): Promise<void> {
  if (!(await isInstalled())) {
    throw new Error(
      "flatc is not installed or not in PATH. " +
        "Install it from https://github.com/google/flatbuffers/releases",
    );
  }

  if (semver) {
    const found = await version();
    if (found !== semver) { // TODO: semver matching
      throw new Error(
        `flatc version ${semver} is required, but found ${
          found ?? "an unknown version"
        }`,
      );
    }
  }
}

export async function execute(...args: string[]): Promise<FlatcResult> {
  const flatc = await $.which("flatc");
  if (!flatc) {
    throw new Error(
      "flatc is not installed or not in PATH. " +
        "Install it from https://github.com/google/flatbuffers/releases",
    );
  }

  const command = ["flatc", ...args].join(" ");
  log.debug(`$ ${command}`);

  const cmd = await $`${flatc} ${args}`.stdout("piped").stderr("piped")
    .noThrow();

  const escaped = `(${RegExp.escape(flatc)})`;
  const regex = new RegExp(escaped, "gi");

  const stdout = cmd.stdout?.replaceAll(regex, "flatc") ?? "";
  const stderr = cmd.stderr?.replaceAll(regex, "flatc") ?? "";

  if (cmd.code != 0) {
    log.debug(`flatc exited with code ${cmd.code}`);
  }

  return {
    success: cmd.code == 0,
    code: cmd.code,
    command,
    stdout,
    stderr,
  };
}
