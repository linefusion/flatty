import type * as vento from "jsr:@vento/vento@1.12.16";
import type * as eta from "jsr:@eta-dev/eta@3.5.0";
import type * as flatbuffers from "./flatbuffers/mod.ts";
import type * as logger from "./logger.ts";
import type * as std from "./std.ts";

import type { Schema } from "./flatbuffers/schema/parser.ts";

export type Generator = (options: {
  schema?: flatbuffers.schema.parser.Schema;
  error: (message: string) => never;
  log: typeof logger.log;
  flatbuffers: {
    loadSchema: (schemaPath: string) => Promise<Schema>;
    compileSchema: (schemaPath: string, ...args: string[]) => Promise<void>;
  };
  templates: {
    eta: typeof eta;
    vento: typeof vento;
  };
  std: typeof std;
}) => Promise<unknown>;

export function generator(impl: Generator): Generator {
  return impl;
}

export class GeneratorError extends Error {
}

export function error(message: string): never {
  throw new GeneratorError(message);
}
