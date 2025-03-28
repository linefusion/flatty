import * as fbs from "./mod.ts";

Deno.test(async function testParseSchema() {
  const rawSchema = await fbs.schema.raw.fromFile(
    "examples/full/schema.fbs",
  );

  const schema = await fbs.schema.parser.fromFile(
    "examples/full/schema.fbs",
  );
});
