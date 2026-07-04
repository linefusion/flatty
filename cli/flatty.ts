import * as flatty from "../mod.ts";

flatty.run().then((success) => {
  Deno.exit(success ? 0 : 1);
});
