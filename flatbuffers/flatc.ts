import { $ } from "jsr:@david/dax@0.42.0";

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
  const cmd = await $`flatc ${args}`.captureCombined(true).noThrow();
  return {
    success: cmd.code == 0,
    output: cmd.combined,
  };
}
