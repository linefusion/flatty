import $ from "jsr:@david/dax@0.42.0";
import { expandGlob } from "jsr:@std/fs@1.0.15";

for await (const file of expandGlob("**/*_gen.ts")) {
  await $`deno run -A ${file.path}`;
}
