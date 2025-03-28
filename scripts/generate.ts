import $ from "jsr:@david/dax";
import { expandGlob } from "jsr:@std/fs";

for await (const file of expandGlob("**/*_gen.ts")) {
  await $`deno run -A ${file.path}`;
}
