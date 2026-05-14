import { $ } from "@david/dax";
import * as path from "@std/path";
import * as os from "node:os";

export async function install() {
  await $`deno compile -A --config ./deno.json --output ${
    path.join(os.homedir(), ".deno/bin/flatty.exe")
  } --target x86_64-pc-windows-msvc mod.ts `;

  await $`deno compile -A --config ./deno.json --output ${"C:\\Users\\wolfu\\AppData\\Local\\.xmake\\packages\\f\\flatty\\0.0.9\\f5166c37982d4ae2be3286549572fe4b\\bin\\flatty.exe"} --target x86_64-pc-windows-msvc mod.ts `;
}

if (import.meta.main) {
  await install();
}
