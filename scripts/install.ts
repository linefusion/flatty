import { $ } from "@david/dax";
import * as path from "@std/path";
import * as os from "node:os";

export async function install() {
  await $`deno compile -A --config ./deno.json --output ${
    path.join(os.homedir(), ".deno/bin/flatty.exe")
  } --target x86_64-pc-windows-msvc mod.ts `;
}

if (import.meta.main) {
  await install();
}
