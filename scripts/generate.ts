import $ from "@david/dax";
import { expandGlob } from "@std/fs";

for await (const file of expandGlob("**/*_gen.ts")) {
  await $`deno run -A ${file.path}`;
}
