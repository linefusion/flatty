import { $ } from "jsr:@david/dax@0.42.0";
import { build } from "./build.ts";
import { ReleaseType } from "jsr:@std/semver@1.0.5/types";

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

  console.log({ version, versionString });

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
}

if (import.meta.main) {
  await deploy(Deno.args?.[0] as ReleaseType);
}
