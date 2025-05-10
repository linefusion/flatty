import { generator } from "@linefusion/flatty";

export default generator(({ schema, error, log }) => {
  if (!schema) {
    error("No schema provided");
  }

  log.warn("I was here");

  return Promise.resolve();
});
