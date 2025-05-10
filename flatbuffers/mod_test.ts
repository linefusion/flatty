import { expect } from "@std/expect/expect";
import * as fbs from "./mod.ts";

Deno.test("flatbuffers", function testParseSchema() {
  expect(fbs).toBeDefined();
});
