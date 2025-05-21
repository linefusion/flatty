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

export async function deploy(release?: ReleaseType) {
  //
  // Build

  const version = await build(release);
  const versionString = `v${version}`;

  //
  // Upload

  console.log("Updating latest release...");
  const uploadLatest = $`gh release upload --clobber latest ./build/*`.text();

  if (!await succeeds($`gh release view ${versionString} --json name`.json())) {
    console.log("Creating release...");
    await $`gh release create ${versionString} ./build/* --latest=false --title ${versionString} --notes ${
      "Release " + versionString
    }`;
  } else {
    console.log("Uploading to existing release...");
    await $`gh release upload --clobber ${versionString} ./build/*`;
  }

  // Updating latest
  await uploadLatest;

  // Publish to JSR.
  await $`deno publish --allow-slow-types`;
}

if (import.meta.main) {
  await deploy(Deno.args?.[0] as ReleaseType);
}
