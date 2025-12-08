import { $ } from "@david/dax";
import { build } from "./build.ts";
import type { ReleaseType } from "@std/semver/types";

async function succeeds(p: Promise<any>) {
  try {
    await p;
    return true;
  } catch (_) {
    return false;
  }
}

async function isDirty() {
  const diff = await $`git diff-files --quiet`.noThrow();
  if (diff.code) {
    return true;
  }
  return false;
}

async function commit(msg: string) {
  await $`git add .`;
  await $`git commit -m ${msg}`;
  await $`git push`;
}

export async function deploy(release: ReleaseType = "patch") {
  // Commit
  if (await isDirty()) {
    throw new Error("git in in dirty state. commit first.");
  }

  await $`deno fmt`;
  if (await isDirty()) {
    await commit("chore: format");
  }

  // Build
  const version = await build(release);
  const versionString = `v${version}`;
  if (await isDirty()) {
    await commit("chore: version bump");
  }

  // Upload
  if (!await succeeds($`gh release view ${versionString} --json name`.json())) {
    console.log("Creating release...");
    await $`gh release create ${versionString} ./build/* --latest=false --title ${versionString} --notes ${
      "Release " + versionString
    }`;
  } else {
    if (!confirm("Version already exists. Upload files on top of it?")) {
      Deno.exit(1);
    }
    console.log("Uploading to existing release...");
    await $`gh release upload --clobber ${versionString} ./build/*`;
  }

  // Upload latest
  console.log("Updating latest release...");
  await $`gh release upload --clobber latest ./build/*`.text();

  // Publish to JSR.
  await $`deno publish --allow-slow-types`;
}

if (import.meta.main) {
  await deploy(Deno.args?.[0] as ReleaseType ?? "patch");
}
