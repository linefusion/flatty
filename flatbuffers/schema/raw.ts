import "npm:tslib";
import "npm:flatbuffers";

import outdent from "jsr:@cspotcode/outdent";

import * as str from "../../strings/mod.ts";
import * as path from "jsr:@std/path";

import { z } from "npm:zod";

import * as fbs from "npm:flatbuffers";
import * as bfbs from "npm:flatbuffers_reflection";

import { ZUtils } from "../_utils.ts";
import { flatc } from "../mod.ts";

export enum AdvancedFeatures {
  None = 0,
  AdvancedArrayFeatures = 1,
  AdvancedUnionFeatures = 2,
  OptionalScalars = 4,
  DefaultVectorsAndStrings = 8,
}

export const TypeNames = [
  "none",
  "utype",
  "bool",
  "byte",
  "ubyte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "float",
  "double",
  "string",
  "vector",
  "obj",
  "union",
  "array",
  "vector64",
] as const;
export type TypeNames = typeof TypeNames;

export const TypeInfo = z.object({
  baseType: ZUtils.type(),
  element: ZUtils.type(),
  index: z.number().int(),
  fixedLength: z.number().int(),
  baseSize: z.number().int(),
  elementSize: z.number().int(),
}).strict();
export type TypeInfo = z.output<typeof TypeInfo>;

export const Attribute = z.object({
  key: z.string(),
  value: z.string(),
}).strict();
export type Attribute = z.output<typeof Attribute>;

export const Attributes = z.array(Attribute);
export type Attributes = z.output<typeof Attributes>;

export const Documentation = z.array(z.string());
export type Documentation = z.output<typeof Documentation>;

export const Field = z.object({
  id: z.number(),
  name: z.string(),
  type: TypeInfo,
  offset: z.number(),
  offset64: z.boolean(),
  defaultInteger: z.number().int(),
  defaultReal: z.number(),
  padding: z.number(),
  deprecated: z.boolean(),
  required: z.boolean(),
  optional: z.boolean(),
  key: z.boolean(),
  attributes: Attributes,
  documentation: Documentation,
}).strict();
export type Field = z.output<typeof Field>;

export const Fields = z.array(Field);
export type Fields = z.output<typeof Fields>;

export const Table = z.object({
  name: z.string().default(""),
  fields: Fields,
  isStruct: z.boolean().default(false),
  minalign: z.number().default(0),
  bytesize: z.number().default(0),
  attributes: z.array(Attribute),
  documentation: Documentation,
  declarationFile: z.string(),
}).strict();
export type Table = z.output<typeof Table>;

export const Tables = z.array(Table);
export type Tables = z.output<typeof Tables>;

export const EnumValue = z.object({
  name: z.string(),
  value: z.number().int(),
  unionType: TypeInfo,
  attributes: Attributes,
  documentation: Documentation,
}).strict();
export type EnumValue = z.output<typeof EnumValue>;

export const Enum = z.object({
  name: z.string(),
  values: z.array(EnumValue),
  isUnion: z.boolean(),
  underlyingType: TypeInfo,
  attributes: Attributes,
  documentation: Documentation,
  declarationFile: z.string(),
}).strict();
export type Enum = z.output<typeof Enum>;

export const Enums = z.array(Enum);
export type Enums = z.output<typeof Enums>;

export const ServiceCall = z.object({
  name: z.string(),
  request: Table,
  response: Table,
  attributes: Attributes,
  documentation: Documentation,
}).strict();
export type ServiceCall = z.output<typeof ServiceCall>;

export const ServiceCalls = z.array(ServiceCall);
export type ServiceCalls = z.output<typeof ServiceCalls>;

export const Service = z.object({
  name: z.string(),
  calls: ServiceCalls,
  attributes: Attributes,
  documentation: Documentation,
  declarationFile: z.string(),
}).strict();
export type Service = z.output<typeof Service>;

export const Services = z.array(Service);
export type Services = z.output<typeof Services>;

export const File = z.object({
  filename: z.string(),
  includedFilenames: z.array(z.string()),
}).strict();
export type File = z.output<typeof File>;

export const Files = z.array(File);
export type Files = z.output<typeof Files>;

export const Schema = ZUtils.field()
  .pipe(
    z.object({
      fileIdent: z.string(),
      fileExt: z.string(),
      advancedFeatures: ZUtils.flags(AdvancedFeatures),
      objects: Tables,
      enums: Enums,
      rootTable: Table.nullable().default(null),
      services: Services,
      fbsFiles: Files,
    }).strict(),
  );
export type Schema = z.output<typeof Schema>;

export const Parser = z
  .instanceof(bfbs.Schema)
  .transform((schema) => {
    return Schema.parse(schema.unpack());
  });
export type Parser = z.output<typeof Parser>;

export async function fromFile(file: string): Promise<Schema> {
  file = path.resolve(file);

  await flatc.assert();

  const temp = await Deno.makeTempDir();
  const output = await flatc.execute(
    "-b",
    "--schema",
    "--bfbs-builtins",
    "--bfbs-comments",
    "--bfbs-gen-embed",
    "--gen-onefile",
    "-o",
    temp,
    file,
  );

  if (!output.success) {
    throw new Error(output.output);
  }

  const buffer = new fbs.ByteBuffer(
    await Deno.readFile(
      path.join(temp, path.basename(file, ".fbs") + ".bfbs"),
    ),
  );

  const schema = bfbs.Schema.getRootAsSchema(buffer);
  return Parser.parse(schema);
}
