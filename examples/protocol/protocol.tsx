import { generator } from "@linefusion/flatty";

export default generator(({ schema, error, inspect }) => {
  if (!schema) {
    error("No schema provided");
  }

  schema?.objects.forEach((v) => inspect(v.fields));

  return Promise.resolve();
});
