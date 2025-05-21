import { $ } from "@david/dax";
import { crypto } from "@std/crypto";
import { encodeHex } from "@std/encoding/hex";
import * as fs from "@std/fs";
import * as path from "@std/path";
import { assert } from "@std/assert";
import * as semver from "@std/semver";
import { unindent } from "@linefusion/strings";

import * as zip from "@quentinadam/zip";

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
    // executable: "C:\\Users\\wolfu\\AppData\\Local\\.xmake\\packages\\f\\flatty\\0.0.8\\aed3e500df8245e5acebd63f3534d6a8\\bin\\flatty.exe",
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

  const hashOf = (filename: string) =>
    hashes.filter(isFullfilled).find((h) =>
      h.value.filename.indexOf(filename) >= 0
    )?.value.hash;

  await Deno.writeTextFile(
    "./build/xmake.lua",
    unindent(`
      package("flatty", function()

        set_kind("binary")
        set_homepage("https://github.com/linefusion/flatty")
        set_description("Flatty Code Generator")

        if is_host("windows") then
          set_urls("https://github.com/linefusion/flatty/releases/download/v$(version)/flatty-windows-x86_64.zip")
          add_versions("${version}", "${hashOf("windows-x86_64")}")
        elseif is_host("linux") then
          if is_arch("arm64") then
            set_urls("https://github.com/linefusion/flatty/releases/download/v$(version)/flatty-linux-aarch64.zip")
            add_versions("${version}", "${hashOf("linux-aarch64")}")
          else
            set_urls("https://github.com/linefusion/flatty/releases/download/v$(version)/flatty-linux-x86_64.zip")
            add_versions("${version}", "${hashOf("linux-x86_64")}")
          end
        elseif is_host("macosx") then
          if is_arch("arm64") then
            set_urls("https://github.com/linefusion/flatty/releases/download/v$(version)/flatty-macos-aarch64.zip")
            add_versions("${version}", "${hashOf("macos-aarch64")}")
          else
            set_urls("https://github.com/linefusion/flatty/releases/download/v$(version)/flatty-macos-x86_64.zip")
            add_versions("${version}", "${hashOf("macos-x86_64")}")
          end
        end

        on_install("windows", "linux", "macosx", function (package)
          os.cp("*", package:installdir("bin"))
          os.cp("*", package:installdir("tools"))
        end)

        on_test(function (package)
          os.execv("flatty", {"--version"})
        end)

      end)

    `),
  );

  console.log(`Built version: ${version}`);
  return version;
}

if (import.meta.main) {
  await build(Deno.args?.[0] as semver.ReleaseType);
}
