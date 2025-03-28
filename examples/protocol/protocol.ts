import { generator } from "../../mod.ts";

export default generator(async ({ schema, error, log }) => {
  if (!schema) {
    error("No schema provided");
  }

  log.info("Hello there!").line();
});
