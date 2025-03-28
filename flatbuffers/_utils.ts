import { z } from "npm:zod@3.24.2";
import { match } from "npm:ts-pattern@5.6.2";
import * as bfbs from "npm:flatbuffers_reflection@1.2.0";

export declare namespace zs {
  type literal_input = z.input<typeof ZUtils.literal>;
  type literal_output = z.output<typeof ZUtils.literal>;

  type field_input =
    | literal_input
    | { [key: string | number]: field_input }
    | field_input[];

  type field_output =
    | literal_output
    | { [key: string | number]: field_output }
    | field_output[];
}

export class ZUtils {
  public static readonly literal = z.union([
    z.undefined(),
    z.null().transform(() => undefined),
    z.bigint().transform((value) => parseInt(value.toString())),
    z.instanceof(Uint8Array).transform((value) =>
      new TextDecoder().decode(value)
    ),
    z.boolean(),
    z.number(),
    z.string(),
  ]);

  public static type() {
    return z.nativeEnum(bfbs.BaseType).transform((value) =>
      match(value)
        .with(bfbs.BaseType.None, () => "none")
        .with(bfbs.BaseType.UType, () => "utype")
        .with(bfbs.BaseType.Bool, () => "bool")
        .with(bfbs.BaseType.Byte, () => "int8")
        .with(bfbs.BaseType.UByte, () => "uint8")
        .with(bfbs.BaseType.Short, () => "int16")
        .with(bfbs.BaseType.UShort, () => "uint16")
        .with(bfbs.BaseType.Int, () => "int32")
        .with(bfbs.BaseType.UInt, () => "uint32")
        .with(bfbs.BaseType.Long, () => "int64")
        .with(bfbs.BaseType.ULong, () => "uint64")
        .with(bfbs.BaseType.Float, () => "float")
        .with(bfbs.BaseType.Double, () => "double")
        .with(bfbs.BaseType.String, () => "string")
        .with(bfbs.BaseType.Vector, () => "vector")
        .with(bfbs.BaseType.Obj, () => "object")
        .with(bfbs.BaseType.Union, () => "union")
        .with(bfbs.BaseType.Array, () => "array")
        .with(bfbs.BaseType.Vector64, () => "vector64")
        .otherwise(() => "unknown")
    );
  }

  public static field(): z.ZodType<
    zs.field_output,
    z.ZodTypeDef,
    zs.field_input
  > {
    return z.lazy(() =>
      z.union([
        ZUtils.literal,
        z.array(ZUtils.field()),
        z.record(ZUtils.field()),
      ])
    );
  }

  public static flags<
    Enum extends Record<string, string | number>,
  >(values: Enum) {
    const bits = Object.values(values)
      .filter((v): v is Enum[keyof Enum] & number => typeof v === "number")
      .reduce((acc, val) => acc | val, 0);

    return z
      .number()
      .int()
      .refine(
        (val): val is Enum[keyof Enum] & number => (val & ~bits) === 0,
        { message: "Invalid flags value" },
      );
  }

  public static flag(value: number, flag: number) {
    return (value & flag) == flag;
  }

  public static isFlagActive(
    combined: string | number,
    check: string | number,
  ) {
    if (typeof check == "string" || typeof combined == "string") {
      // TODO: tokenize value and check presence of flag instead
      return check === combined;
    }
    return (combined & check) == check;
  }

  public static flagMap<
    Enum extends Record<string, string | number>,
    Mapper extends Record<string, Enum[string]>,
  >(
    source: Enum,
    mapping: Mapper,
  ) {
    return ZUtils
      .flags(source)
      .transform((flags) =>
        Object
          .entries(mapping)
          .map(([key, flag]) => ({ [key]: this.isFlagActive(flags, flag) }))
          .reduce((current, value) => Object.assign(current, value), {}) as {
            [K in keyof Mapper]: boolean;
          }
      );
  }
}
