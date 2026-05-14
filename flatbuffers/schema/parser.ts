import "tslib";
import "flatbuffers";

import outdent from "@cspotcode/outdent";

import * as str from "@linefusion/strings";
import * as path from "@std/path";

import { z } from "zod";
import { ZUtils } from "../_utils.ts";

import * as Raw from "./raw.ts";

/**
 * Schema Processing
 */

const _AttributeKey = z.string();
export type AttributeKey = z.output<typeof AttributeKey>;
export const AttributeKey: typeof _AttributeKey = _AttributeKey;

const _AttributeValue = z.array(z.unknown());
export type AttributeValue = z.output<typeof AttributeValue>;
export const AttributeValue: typeof _AttributeValue = _AttributeValue;

const _Attributes = z.record(
  AttributeKey,
  AttributeValue,
);
export type Attributes = z.output<typeof Attributes>;
export const Attributes: typeof _Attributes = _Attributes;

const _TypePrimitive = z.object({
  kind: z.literal("primitive"),
  name: z.string(),
});
export type TypePrimitive = z.output<typeof _TypePrimitive>;
export const TypePrimitive: typeof _TypePrimitive = _TypePrimitive;

const _TypeTable = z.object({
  kind: z.literal("table"),
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
});
export type TypeTable = z.output<typeof _TypeTable>;
export const TypeTable: typeof _TypeTable = _TypeTable;

const _TypeStruct = z.object({
  kind: z.literal("struct"),
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
});
export type TypeStruct = z.output<typeof _TypeStruct>;
export const TypeStruct: typeof _TypeStruct = _TypeStruct;

const _TypeEnum = z.object({
  kind: z.literal("enum"),
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
});
export type TypeEnum = z.output<typeof _TypeEnum>;
export const TypeEnum: typeof _TypeEnum = _TypeEnum;

const _TypeArray = z.object({
  kind: z.literal("array"),
  type: z.lazy(() => _Type),
});
export type TypeArray = z.output<typeof TypeArray>;
export const TypeArray: typeof _TypeArray = _TypeArray;

const _Type = z.union([
  _TypePrimitive,
  _TypeTable,
  _TypeStruct,
  _TypeEnum,
]);
export type Type = z.output<typeof Type>;
export const Type: typeof _Type = _Type;

const _TypeInfo = z.object({
  type: z.string(),
  size: ZUtils.int(),
  element: z.string(),
  elementSize: ZUtils.int(),
  index: ZUtils.int(),
  length: ZUtils.int(),
  data: z.any().nullable().optional().default(null),
}).strict();
export type TypeInfo = z.output<typeof TypeInfo>;
export const TypeInfo: typeof _TypeInfo = _TypeInfo;

const _Documentation = z.object({
  text: z.string(),
  lines: z.array(z.string()),
}).strict();
export type Documentation = z.output<typeof Documentation>;
export const Documentation: typeof _Documentation = _Documentation;

const _EnumValue = z.object({
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
  type: TypeInfo,
  value: ZUtils.int(),
  attributes: Attributes,
  documentation: Documentation,
}).strict();
export type EnumValue = z.output<typeof EnumValue>;
export const EnumValue: typeof _EnumValue = _EnumValue;

const _Enum = z.object({
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
  type: TypeInfo,
  values: z.array(EnumValue),
  attributes: Attributes,
  documentation: Documentation,
  file: z.string(),
}).strict();
export type Enum = z.output<typeof Enum>;
export const Enum: typeof _Enum = _Enum;

const _Enums = z.array(Enum);
export type Enums = z.output<typeof Enums>;
export const Enums: typeof _Enums = _Enums;

const _Meta = z.object({
  header: z.string(),
  extension: z.string(),
}).strict();
export type Meta = z.output<typeof Meta>;
export const Meta: typeof _Meta = _Meta;

const _File = z.object({
  path: z.string(),
  includes: z.array(z.string()),
}).strict();

export type File = z.output<typeof File>;
export const File: typeof _File = _File;

const _Files = z.array(File);
export type Files = z.output<typeof Files>;
export const Files: typeof _Files = _Files;

const _Field = z.object({
  id: ZUtils.int(),
  name: z.instanceof(str.Tokens),
  type: TypeInfo,
  offset: ZUtils.int(),
  offset64: z.boolean(),
  defaultInteger: ZUtils.int(),
  defaultReal: ZUtils.int(),
  padding: ZUtils.int(),
  deprecated: z.boolean(),
  required: z.boolean(),
  optional: z.boolean(),
  key: z.boolean(),
  attributes: Attributes,
  documentation: Documentation,
}).strict();
export type Field = z.output<typeof Field>;
export const Field: typeof _Field = _Field;

const _Fields = z.array(Field);
export type Fields = z.output<typeof Fields>;
export const Fields: typeof _Fields = _Fields;

const _Table = z.object({
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
  fields: Fields,
  //isStruct: z.boolean().default(false),
  minalign: ZUtils.int().default(0),
  bytesize: ZUtils.int().default(0),
  attributes: Attributes,
  documentation: Documentation,
  declarationFile: z.string(),
}).strict();
export type Table = z.output<typeof Table>;
export const Table: typeof _Table = _Table;

const _Tables = z.array(Table);
export type Tables = z.output<typeof Tables>;
export const Tables: typeof _Tables = _Tables;

const _Features = z.object({
  advanced_array_features: z.boolean().default(false),
  advanced_union_features: z.boolean().default(false),
  default_vectors_as_strings: z.boolean().default(false),
  optional_scalars: z.boolean().default(false),
}).strict();
export type Features = typeof Features;
export const Features: typeof _Features = _Features;

const _ServiceCall = z.object({
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
  request: Table,
  response: Table,
  attributes: Attributes,
  documentation: Documentation,
}).strict();
export type ServiceCall = z.output<typeof ServiceCall>;
export const ServiceCall: typeof _ServiceCall = _ServiceCall;

const _ServiceCalls = z.array(ServiceCall);
export type ServiceCalls = z.output<typeof ServiceCalls>;
export const ServiceCalls: typeof _ServiceCalls = _ServiceCalls;

const _Service = z.object({
  name: z.instanceof(str.Tokens),
  namespace: z.instanceof(str.Tokens),
  calls: ServiceCalls,
  attributes: Attributes,
  documentation: Documentation,
  file: z.string(),
}).strict();
export type Service = z.output<typeof Service>;
export const Service: typeof _Service = _Service;

const _Services = z.array(Service);
export type Services = z.output<typeof Services>;
export const Services: typeof _Services = _Services;

const _Schema = z.object({
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
export const Schema: typeof _Schema = _Schema;

export function nameFromRaw(
  _$: Raw.Schema,
  name: string,
) {
  return str.tokenize(str.split(name, ".").slice(-1).join(), "_");
}

export function namespaceFromRaw(
  _$: Raw.Schema,
  name: string,
) {
  const parts = str.split(name, ".");
  return str.tokenize(parts.slice(0, -1).join("."), ".");
}

export function attributesFromRaw(
  _$: Raw.Schema,
  attributes: Raw.Attribute[],
) {
  return attributes.reduce((result, attribute) => {
    const key = attribute.key as keyof typeof result;
    result[key] = result[key] ?? [];
    result[key].push(attribute.value);
    return result;
  }, {} as Record<string, unknown[]>);
}

export function documentationFromRaw(
  _$: Raw.Schema,
  documentation: Raw.Documentation,
) {
  const text = outdent.string(documentation.join("\n"));
  return {
    text,
    lines: documentation,
  };
}

export function typeFromRaw(
  $: Raw.Schema,
  type: Raw.TypeInfo,
): z.output<typeof TypeInfo> {
  let data: Type = {
    kind: "primitive",
    name: type.baseType,
  };

  if (type.index >= 0) {
    const obj = $.objects?.[type.index];
    if (obj?.isStruct) {
      data = {
        kind: "struct",
        name: nameFromRaw($, obj.name),
        namespace: namespaceFromRaw($, obj.name),
      };
    } else {
      data = {
        kind: "table",
        name: nameFromRaw($, obj.name),
        namespace: namespaceFromRaw($, obj.name),
      };
    }
  }

  return {
    type: type.baseType,
    size: type.baseSize,
    element: type.element,
    elementSize: type.elementSize,
    index: type.index,
    length: type.fixedLength,
    data,
  };
}

export function enumValueFromRaw(
  $: Raw.Schema,
  item: Raw.EnumValue,
  namespace: str.Tokens,
): z.output<typeof EnumValue> {
  return {
    name: nameFromRaw($, item.name),
    namespace: namespace,
    value: item.value,
    attributes: attributesFromRaw($, item.attributes),
    documentation: documentationFromRaw($, item.documentation),
    type: typeFromRaw($, item.unionType),
  };
}
export function enumValuesFromRaw(
  $: Raw.Schema,
  items: Raw.EnumValue[],
  namespace: str.Tokens,
): z.output<typeof EnumValue>[] {
  return items.map((item) => enumValueFromRaw($, item, namespace));
}

export function fileFromRaw(
  _$: Raw.Schema,
  root: string,
  file: string,
) {
  return path.relative(root, path.join(root, file)).replaceAll("\\", "/");
}

export function enumFromRaw(
  $: Raw.Schema,
  root: string,
  value: Raw.Enum,
): z.output<typeof Enum> {
  return ({
    name: nameFromRaw($, value.name),
    namespace: namespaceFromRaw($, value.name),
    type: typeFromRaw($, value.underlyingType),
    values: enumValuesFromRaw(
      $,
      value.values,
      namespaceFromRaw($, value.name),
    ),
    attributes: attributesFromRaw($, value.attributes),
    documentation: documentationFromRaw($, value.documentation),
    file: fileFromRaw($, root, value.declarationFile),
  });
}

export function fieldsFromRaw(
  $: Raw.Schema,
  _utilsroot: string,
  fields: Raw.Fields,
): Fields {
  return fields.map((field) => ({
    id: field.id,
    name: nameFromRaw($, field.name),
    attributes: attributesFromRaw($, field.attributes),
    documentation: documentationFromRaw($, field.documentation),
    defaultInteger: field.defaultInteger,
    defaultReal: field.defaultReal,
    deprecated: field.deprecated,
    key: field.key,
    offset: field.offset,
    offset64: field.offset64,
    optional: field.optional,
    padding: field.padding,
    required: field.required,
    type: typeFromRaw($, field.type),
  }));
}

export function tableFromRaw(
  $: Raw.Schema,
  root: string,
  table: Raw.Table,
  //raw: Raw.Tables,
): Table {
  return ({
    name: nameFromRaw($, table.name),
    namespace: namespaceFromRaw($, table.name),
    fields: fieldsFromRaw($, root, table.fields),
    attributes: attributesFromRaw($, table.attributes),
    documentation: documentationFromRaw($, table.documentation),
    declarationFile: fileFromRaw($, root, table.declarationFile),
    bytesize: table.bytesize,
    minalign: table.minalign,
  });
}

export function tablesFromRaw(
  $: Raw.Schema,
  root: string,
  tables: Raw.Tables,
): Tables {
  return tables.map((table) => tableFromRaw($, root, table));
}

export function callFromRaw(
  $: Raw.Schema,
  root: string,
  call: Raw.ServiceCall,
): ServiceCall {
  return ({
    name: nameFromRaw($, call.name),
    namespace: namespaceFromRaw($, call.name),
    request: tableFromRaw($, root, call.request),
    response: tableFromRaw($, root, call.response),
    attributes: attributesFromRaw($, call.attributes),
    documentation: documentationFromRaw($, call.documentation),
  });
}

export function callsFromRaw(
  $: Raw.Schema,
  root: string,
  calls: Raw.ServiceCalls,
): ServiceCalls {
  return calls.map((call) => callFromRaw($, root, call));
}

export function serviceFromRaw(
  $: Raw.Schema,
  root: string,
  service: Raw.Service,
): Service {
  return ({
    name: nameFromRaw($, service.name),
    namespace: namespaceFromRaw($, service.name),
    calls: callsFromRaw($, root, service.calls),
    attributes: attributesFromRaw($, service.attributes),
    documentation: documentationFromRaw($, service.documentation),
    file: fileFromRaw($, root, service.declarationFile),
  });
}

export function servicesFromRaw(
  $: Raw.Schema,
  root: string,
  services: Raw.Services,
): Services {
  return services.map((service) => serviceFromRaw($, root, service));
}

export async function fromFile(
  file: string,
): Promise<Schema> {
  file = path.resolve(file);

  const raw = await Raw.fromFile(file);
  const rootDir = path.dirname(file);

  const enums = raw.enums
    .filter((item) => !item.isUnion)
    .map((item) => enumFromRaw(raw, rootDir, item));

  const unions = raw.enums
    .filter((item) => item.isUnion)
    .map((item) => enumFromRaw(raw, rootDir, item));

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

  const objects = raw.objects.map((item) => tableFromRaw(raw, rootDir, item));

  const structs = raw.objects
    .filter((item) => item.isStruct)
    .map((table) => tableFromRaw(raw, rootDir, table));

  const tables = raw.objects
    .filter((item) => !item.isStruct)
    .map((table) => tableFromRaw(raw, rootDir, table));

  const root = raw.rootTable ? tableFromRaw(raw, rootDir, raw.rootTable) : null;

  const services = servicesFromRaw(raw, rootDir, raw.services);

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
