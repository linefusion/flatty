import { $ } from "@david/dax";

export async function isInstalled() {
  try {
    return await $.which("flatc") !== undefined;
  } catch (_) {
    return undefined;
  }
}

export async function version() {
  try {
    const version = await $`flatc --version`.quiet().text();
    return version.replace(/flatc version /gm, "").trim();
  } catch (_) {
    return undefined;
  }
}

export async function assert(semver?: string) {
  if (!isInstalled()) {
    throw new Error("flatc is not installed");
  }

  if (semver) {
    const v = await version();
    if (v !== semver) { // TODO: semver matching
      throw new Error(
        `Flatc version ${semver} is required, but found ${version}`,
      );
    }
  }
}

export async function execute(...args: string[]) {
  const flatc = await $.which("flatc");
  if (!flatc) {
    throw new Error("flatc is not installed");
  }

  const cmd = await $`${flatc} ${args}`.stdout("piped").stderr("piped")
    .noThrow();

  const escaped = `(${RegExp.escape(flatc)})`;
  const regex = new RegExp(escaped, "gi");

  let stdout = cmd.stdout;
  stdout = stdout?.replaceAll(regex, "flatc") ??
    "<empty>";

  let stderr = cmd.stderr;
  stderr = stderr?.replaceAll(regex, "flatc") ??
    "<empty>";

  return {
    success: cmd.code == 0,
    stderr,
    stdout,
  };
}
