# Flatty

Flatt but flattier.

## How?

> schema.fbs

```ts
table Hello {
  name:string;
}
```

> schema.ts

```ts filename="aaa"
import { generator } from "@linefusion/flatty";

export default generator(async ({ schema, error, log }) => {
  if (!schema) {
    error("No schema provided");
  }

  log.info(schema).line();
});
```
