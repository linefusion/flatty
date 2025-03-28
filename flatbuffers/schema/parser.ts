import "npm:tslib@2.8.1";
import "npm:flatbuffers@25.2.10";

import outdent from "jsr:@cspotcode/outdent@0.8.0";

import * as str from "../../strings/mod.ts";
import * as path from "jsr:@std/path@1.0.8";

import { z } from "npm:zod@3.24.2";
import { ZUtils } from "../_utils.ts";

import * as Raw from "./raw.ts";

/**
 * Schema Processing
 */

export const AttributeKey = z.string();
export type AttributeKey = z.output<typeof AttributeKey>;

export const AttributeValue = z.array(z.unknown());
export type AttributeValue = z.output<typeof AttributeValue>;

export const Attributes = z.record(
  AttributeKey,
  AttributeValue,
);
export type Attributes = z.output<typeof Attributes>;

export const TypeInfo = z.object({
  type: z.string(),
  size: z.number().int(),
  element: z.string(),
  elementSize: z.number().int(),
  index: z.number().int(),
  length: z.number().int(),
}).strict();
export type TypeInfo = z.output<typeof TypeInfo>;

export const Documentation = z.object({
  text: z.string(),
  lines: z.array(z.string()),
}).strict();
export type Documentation = z.output<typeof Documentation>;

export const EnumValue = z.object({
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
  type: TypeInfo,
  value: z.number().int(),
  attributes: Attributes,
  documentation: Documentation,
}).strict();
export type EnumValue = z.output<typeof EnumValue>;

export const Enum = z.object({
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
  type: TypeInfo,
  values: z.array(EnumValue),
  attributes: Attributes,
  documentation: Documentation,
  file: z.string(),
}).strict();
export type Enum = z.output<typeof Enum>;

export const Enums = z.array(Enum);
export type Enums = z.output<typeof Enums>;

export const Meta = z.object({
  header: z.string(),
  extension: z.string(),
}).strict();
export type Meta = z.output<typeof Meta>;

export const File = z.object({
  path: z.string(),
  includes: z.array(z.string()),
}).strict();
export type File = z.output<typeof File>;

export const Files = z.array(File);
export type Files = z.output<typeof Files>;

export const Field = z.object({
  id: z.number(),
  name: z.instanceof(str.Tokens),
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
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
  fields: Fields,
  //isStruct: z.boolean().default(false),
  minalign: z.number().default(0),
  bytesize: z.number().default(0),
  attributes: Attributes,
  documentation: Documentation,
  declarationFile: z.string(),
}).strict();
export type Table = z.output<typeof Table>;

export const Tables = z.array(Table);
export type Tables = z.output<typeof Tables>;

export const Features = z.object({
  advanced_array_features: z.boolean().default(false),
  advanced_union_features: z.boolean().default(false),
  default_vectors_as_strings: z.boolean().default(false),
  optional_scalars: z.boolean().default(false),
}).strict();
export type Features = typeof Features;

export const ServiceCall = z.object({
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
  request: Table,
  response: Table,
  attributes: Attributes,
  documentation: Documentation,
}).strict();
export type ServiceCall = z.output<typeof ServiceCall>;

export const ServiceCalls = z.array(ServiceCall);
export type ServiceCalls = z.output<typeof ServiceCalls>;

export const Service = z.object({
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
  calls: ServiceCalls,
  attributes: Attributes,
  documentation: Documentation,
  file: z.string(),
}).strict();
export type Service = z.output<typeof Service>;

export const Services = z.array(Service);
export type Services = z.output<typeof Services>;

export const Schema = z.object({
  meta: Meta,
  features: Features,
  root: Table.nullable().default(null),
  enums: Enums,
  unions: Enums,
  objects: Tables,
  structs: Tables,
  tables: Tables,
  services: Services,
  files: Files,
}).strict();

export type Schema = z.output<typeof Schema>;

export function nameFromRaw(name: string) {
  return str.tokenize(str.split(name, ".").slice(-1).join(), "_");
}

export function namespaceFromRaw(name: string) {
  const parts = str.split(name, ".");
  return str.tokenize(parts.slice(0, -1).join("."), ".");
}

export function attributesFromRaw(attributes: Raw.Attribute[]) {
  return attributes.reduce((result, attribute) => {
    const key = attribute.key as keyof typeof result;
    result[key] = result[key] ?? [];
    result[key].push(attribute.value);
    return result;
  }, {} as Record<string, unknown[]>);
}

export function documentationFromRaw(
  documentation: Raw.Documentation,
) {
  const text = outdent.string(documentation.join("\n"));
  return {
    text,
    lines: documentation,
  };
}

export function typeFromRaw(
  type: Raw.TypeInfo,
): z.output<typeof TypeInfo> {
  return {
    type: type.baseType,
    size: type.baseSize,
    element: type.element,
    elementSize: type.elementSize,
    index: type.index,
    length: type.fixedLength,
  };
}

export function enumValueFromRaw(
  item: Raw.EnumValue,
  namespace: str.Tokens,
): z.output<typeof EnumValue> {
  return {
    name: nameFromRaw(item.name),
    namespace: namespace,
    value: item.value,
    attributes: attributesFromRaw(item.attributes),
    documentation: documentationFromRaw(item.documentation),
    type: typeFromRaw(item.unionType),
  };
}
export function enumValuesFromRaw(
  items: Raw.EnumValue[],
  namespace: str.Tokens,
): z.output<typeof EnumValue>[] {
  return items.map((item) => enumValueFromRaw(item, namespace));
}

export function fileFromRaw(root: string, file: string) {
  return path.relative(root, path.join(root, file)).replaceAll("\\", "/");
}

export function enumFromRaw(
  root: string,
  value: Raw.Enum,
): z.output<typeof Enum> {
  return ({
    name: nameFromRaw(value.name),
    namespace: namespaceFromRaw(value.name),
    type: typeFromRaw(value.underlyingType),
    values: enumValuesFromRaw(
      value.values,
      namespaceFromRaw(value.name),
    ),
    attributes: attributesFromRaw(value.attributes),
    documentation: documentationFromRaw(value.documentation),
    file: fileFromRaw(root, value.declarationFile),
  });
}

export function fieldsFromRaw(
  root: string,
  fields: Raw.Fields,
): Fields {
  return fields.map((field) => ({
    id: field.id,
    name: nameFromRaw(field.name),
    attributes: attributesFromRaw(field.attributes),
    documentation: documentationFromRaw(field.documentation),
    defaultInteger: field.defaultInteger,
    defaultReal: field.defaultReal,
    deprecated: field.deprecated,
    key: field.key,
    offset: field.offset,
    offset64: field.offset64,
    optional: field.optional,
    padding: field.padding,
    required: field.required,
    type: typeFromRaw(field.type),
  }));
}

export function tableFromRaw(
  root: string,
  table: Raw.Table,
): Table {
  return ({
    name: nameFromRaw(table.name),
    namespace: namespaceFromRaw(table.name),
    fields: fieldsFromRaw(root, table.fields),
    attributes: attributesFromRaw(table.attributes),
    documentation: documentationFromRaw(table.documentation),
    declarationFile: fileFromRaw(root, table.declarationFile),
    bytesize: table.bytesize,
    minalign: table.minalign,
  });
}

export function tablesFromRaw(
  root: string,
  tables: Raw.Tables,
): Tables {
  return tables.map((table) => tableFromRaw(root, table));
}

export function callFromRaw(
  root: string,
  call: Raw.ServiceCall,
): ServiceCall {
  return ({
    name: nameFromRaw(call.name),
    namespace: namespaceFromRaw(call.name),
    request: tableFromRaw(root, call.request),
    response: tableFromRaw(root, call.response),
    attributes: attributesFromRaw(call.attributes),
    documentation: documentationFromRaw(call.documentation),
  });
}

export function callsFromRaw(
  root: string,
  calls: Raw.ServiceCalls,
): ServiceCalls {
  return calls.map((call) => callFromRaw(root, call));
}

export function serviceFromRaw(
  root: string,
  service: Raw.Service,
): Service {
  return ({
    name: nameFromRaw(service.name),
    namespace: namespaceFromRaw(service.name),
    calls: callsFromRaw(root, service.calls),
    attributes: attributesFromRaw(service.attributes),
    documentation: documentationFromRaw(service.documentation),
    file: fileFromRaw(root, service.declarationFile),
  });
}

export function servicesFromRaw(
  root: string,
  services: Raw.Services,
): Services {
  return services.map((service) => serviceFromRaw(root, service));
}

export async function fromFile(file: string): Promise<Schema> {
  file = path.resolve(file);

  const raw = await Raw.fromFile(file);
  const rootDir = path.dirname(file);

  const enums = raw.enums
    .filter((item) => !item.isUnion)
    .map((item) => enumFromRaw(rootDir, item));

  const unions = raw.enums
    .filter((item) => item.isUnion)
    .map((item) => enumFromRaw(rootDir, item));

  const meta: z.output<typeof Meta> = {
    header: raw.fileIdent,
    extension: raw.fileExt,
  };

  const features = {
    advanced_array_features: ZUtils.isFlagActive(
      raw.advancedFeatures,
      Raw.AdvancedFeatures.AdvancedArrayFeatures,
    ),
    advanced_union_features: ZUtils.isFlagActive(
      raw.advancedFeatures,
      Raw.AdvancedFeatures.AdvancedUnionFeatures,
    ),
    default_vectors_as_strings: ZUtils.isFlagActive(
      raw.advancedFeatures,
      Raw.AdvancedFeatures.DefaultVectorsAndStrings,
    ),
    optional_scalars: ZUtils.isFlagActive(
      raw.advancedFeatures,
      Raw.AdvancedFeatures.OptionalScalars,
    ),
  };

  function convertIncludedFile(file: Raw.File): File {
    return {
      path: path.join(rootDir, file.filename),
      includes: file.includedFilenames.map((include) =>
        path.join(rootDir, include)
      ),
    };
  }

  function sortFiles(
    root: string,
    files: File[],
  ): File[] {
    const sorted: File[] = [];

    const findAndRemove = (items: File[], file: string) => {
      const itemIndex = items.findIndex((item) => item.path === file);
      if (itemIndex < 0) {
        return {
          item: null,
          remaining: items,
        };
      }

      const item = items[itemIndex];
      let remaining = [
        ...items.slice(0, itemIndex),
        ...items.slice(itemIndex + 1),
      ];

      // Remove duplicates
      remaining = remaining.filter((item) => item.path != file);
      return {
        item,
        remaining,
      };
    };

    let { item, remaining } = findAndRemove(files, root);
    if (!item) {
      throw new Error("Schema file not found in files list.");
    }

    remaining = [item, ...remaining];
    while (remaining.length > 0) {
      const current = remaining.shift()!;
      sorted.push(current);

      const includes: File[] = [];
      current.includes.forEach((include) => {
        const result = findAndRemove(remaining, include);
        if (!result.item) {
          return;
        }

        includes.push(result.item);
        remaining = result.remaining;
      });

      // Move all includes to the front of the queue, in order
      remaining = [...includes, ...remaining];
    }

    return sorted;
  }

  const files = sortFiles(file, raw.fbsFiles.map(convertIncludedFile));

  const objects = raw.objects.map((item) => tableFromRaw(rootDir, item));

  const structs = raw.objects
    .filter((item) => item.isStruct)
    .map((table) => tableFromRaw(rootDir, table));

  const tables = raw.objects
    .filter((item) => !item.isStruct)
    .map((table) => tableFromRaw(rootDir, table));

  const root = raw.rootTable ? tableFromRaw(rootDir, raw.rootTable) : null;

  const services = servicesFromRaw(rootDir, raw.services);

  return Schema.parse({
    meta, // ok
    features, // ok
    enums, // ok
    unions, // ok
    root, // ok
    tables, // ok
    structs, // ok
    services, // ok
    objects, // ok
    files, // ok
  });
}
