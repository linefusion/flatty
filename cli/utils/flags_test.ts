import { expect } from "jsr:@std/expect@1.0.14";

import {
  action,
  argument,
  flag,
  lit,
  one,
  option,
  prefix,
} from "../utils/mod.ts";

Deno.test(async function addTest() {
  const cmd = action(
    lit("docker"),
    lit("--help"),
  );

  const args = await cmd();
  expect(args).toEqual(["docker", "--help"]);
});

Deno.test(async function addTest() {
  const cmd = action(
    "docker",
    "buildx",
    "build",
    flag("pull", "--pull"),
    option("tag", prefix("--tag")),
    argument("path", one, "."),
  );

  const args = await cmd({ pull: true });
  expect(args).toEqual(["docker", "buildx", "build", "--pull", "."]);
});
