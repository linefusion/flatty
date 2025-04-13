import { $ } from "jsr:@david/dax@0.42.0";
import { crypto } from "jsr:@std/crypto@1.0.4";
import { encodeHex } from "jsr:@std/encoding@1.0.8/hex";
import * as fs from "jsr:@std/fs@1.0.15";
import * as path from "jsr:@std/path@1.0.8";
import { assert } from "jsr:@std/assert@1.0.12";
import * as semver from "jsr:@std/semver@1.0.5";
import { unindent } from "../strings/mod.ts";

import * as zip from "jsr:@quentinadam/zip@0.1.4";

function isFullfilled<T>(
  value: PromiseSettledResult<T>,
): value is PromiseFulfilledResult<T> {
  return value.status === "fulfilled";
}

function isRejected(
  value: PromiseSettledResult<unknown>,
): value is PromiseRejectedResult {
  return value.status !== "fulfilled";
}

export type VersionBump = "patch" | "minor" | "major";

export async function build(release?: semver.ReleaseType) {
  //
  // Targets

  const targets = [
    ["x86_64-pc-windows-msvc", "flatty-windows-x86_64", ".exe"],
    ["x86_64-unknown-linux-gnu", "flatty-linux-x86_64", ""],
    ["aarch64-unknown-linux-gnu", "flatty-linux-aarch64", ""],
    ["x86_64-apple-darwin", "flatty-macos-x86_64", ""],
    ["aarch64-apple-darwin", "flatty-macos-aarch64", ""],
  ].map(([triplet, output, extension]) => ({
    triplet,
    extension,
    zip: `./build/${output}.zip`,
    executable: `./build/${output}${extension}`,
    checksum: `./build/${output}.sha256`,
  }));

  //
  // Setup directory

  if (import.meta.dirname) {
    Deno.chdir(path.dirname(import.meta.dirname));
  } else if (import.meta.filename) {
    Deno.chdir(path.dirname(path.dirname(import.meta.filename)));
  } else {
    Deno.chdir(path.dirname(path.dirname(path.fromFileUrl(import.meta.url))));
  }

  assert(await fs.exists(`./deno.json`), "Failed to infer repository root.");

  //
  // Cleanup
  if (await fs.exists("./build")) {
    await Deno.remove("./build", { recursive: true });
  }

  //
  // Metadata

  let deno = JSON.parse(await Deno.readTextFile("./deno.json"));
  let version = deno.version;

  if (release) {
    version = semver.increment(semver.parse(deno.version), release);
    if (!version) {
      throw new Error("Failed to parse version.");
    }

    deno.version = semver.format(version);
    await Deno.writeTextFile("./deno.json", JSON.stringify(deno, null, 2));
  }

  deno = JSON.parse(await Deno.readTextFile("./deno.json"));
  version = deno.version;

  await Deno.writeTextFile(
    "./metadata.ts",
    unindent(`
    export const VERSION = "${deno.version}";
  `),
  );

  //
  // Compilation

  const compilations: PromiseSettledResult<any>[] = await Promise.allSettled(
    targets.map((target) =>
      $`deno compile -A --config ./deno.json --output ${target.executable} --target ${target.triplet} mod.ts`
    ),
  );

  if (compilations.some(isRejected)) {
    throw new Error("Some target(s) failed to compile.");
  }

  const zips: PromiseSettledResult<any>[] = await Promise.allSettled(
    targets.map(async (target) => {
      await Deno.writeFile(
        target.zip,
        await zip.create([
          {
            name: `flatty${target.extension}`,
            data: await Deno.readFile(target.executable),
          },
        ]),
      );
      await Deno.remove(target.executable);
    }),
  );

  if (zips.some(isRejected)) {
    throw new Error("Some target(s) failed to zip.");
  }

  //
  // Checksum

  const hashes = await Promise.allSettled(
    targets
      .toSorted((a, b) => a.executable.localeCompare(b.executable))
      .map(async (target) => {
        await using file = await Deno.open(target.zip, { read: true });

        const hash = encodeHex(
          await crypto.subtle.digest(
            "SHA-256",
            file.readable,
          ),
        );

        await Deno.writeTextFile(
          target.checksum,
          hash,
        );

        return ({
          filename: path.basename(target.zip),
          hash,
        });
      }),
  );

  if (hashes.some(isRejected)) {
    console.log(hashes);
    throw new Error("Some target(s) failed to checksum.");
  }

  await Deno.writeTextFile(
    `./build/sha256sum.txt`,
    hashes.filter(isFullfilled)
      .map((hash) => `${hash.value.hash}  ./${hash.value.filename}`)
      .join("\n"),
  );

  console.log(`Built version: ${version}`);
  return version;
}

if (import.meta.main) {
  await build(Deno.args?.[0] as semver.ReleaseType);
}
