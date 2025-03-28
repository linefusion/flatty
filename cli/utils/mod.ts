import { match, P } from "npm:ts-pattern@5.6.2";
import { $ } from "jsr:@david/dax@0.42.0";

export type TypeSerializer<Type = any> = (
  value: Type,
) => Type extends unknown[] ? string[] : [string];

export type TypeFromSerializer<Serializer extends TypeSerializer<any>> =
  Serializer extends TypeSerializer<infer Type> ? Type : never;

export type Argument<
  Name extends string,
  Serializer extends TypeSerializer,
> = {
  $kind: "argument";
  name: Name;
  serialize: Serializer;
};

export function one(value: string): [string] {
  return [`${value}`];
}

export function many(values: string[]): string[] {
  return values.map((value) => `${value}`);
}

export function argumentsss<
  const Name extends string,
  const Serializer extends TypeSerializer = typeof one,
>(name: Name, serializer: Serializer): Argument<Name, Serializer> {
  return <any> {
    $kind: "argument",
    name,
    serializer,
  };
}

export type Option<
  Name extends string,
  Serializer extends TypeSerializer,
> = {
  $kind: "option";
  name: Name;
  serializer: Serializer;
};

export type Parameter<Name extends string, Serializer extends TypeSerializer> =
  | Argument<Name, Serializer>
  | Option<Name, Serializer>;

export interface WrapperData {
  find(dax: typeof $): Promise<string | undefined>;
  version(dax: typeof $): Promise<string>;
  argument?(value: unknown): Promise<string[]>;
  option?(name: string, value: unknown): Promise<string[]>;
}

export type Metadata<
  Action extends Parameter<any, any>[],
> = {
  action: Action;
  //commands: Commands;
};

export type ParametersFromAction<Action extends Parameter<any, any>[]> =
  Action extends [infer First, ...infer Rest] ?
      & (First extends Argument<infer Name, infer Serializer>
        ? { [K in Name]: TypeFromSerializer<Serializer> }
        : never)
      & (Rest extends Parameter<any, any>[] ? ParametersFromAction<Rest> : {})
    : Action extends [infer First] ? (
        (First extends Argument<infer Name, infer Serializer>
          ? { [K in Name]: TypeFromSerializer<Serializer> }
          : never)
      )
    : {};

export type Build<
  Action extends Parameter<any, any>[],
> = {
  run(args: ParametersFromAction<Action>): Promise<void>;
};

export class Builder<
  Action extends Parameter<any, any>[],
  Commands extends Record<string, any>,
> {
  action<Action extends Parameter<any, any>[]>(..._args: Action): Builder<
    Action,
    Commands
  > {
    return this as any;
  }

  command<
    const Name extends string,
    const Arguments extends Argument<string, TypeSerializer>[],
  >(name: Name, _args: Arguments): Builder<
    Action,
    & Commands
    & {
      [K in Name]: any;
    }
  > {
    name;
    return this as any;
  }

  build(): Build<Action> {
    return {} as any;
  }
}

export interface AggregatorFunction {
  (context?: any): Promise<string[]>;
}

export interface Aggregator<Kind extends string> {
  kind: Kind;
  aggregate: AggregatorFunction;
}

export interface NamedAggregator<
  Name extends string | undefined,
  Kind extends string,
> extends Aggregator<Kind> {
  name: Name;
}

export function aggregator<
  const Kind extends string,
>(
  kind: Kind,
  aggregate: AggregatorFunction,
): NamedAggregator<undefined, Kind>;

export function aggregator<
  const Name extends string,
  const Kind extends string,
>(
  name: Name,
  kind: Kind,
  aggregate: AggregatorFunction,
): NamedAggregator<Name, Kind>;

export function aggregator(
  name?: unknown,
  kind?: unknown,
  aggregate?: unknown,
): NamedAggregator<any, any> {
  return <any> match([name, kind, aggregate])
    .with(
      [P.string, P.string, P.instanceOf(Function)],
      ([name, kind, aggregate]) => ({
        name,
        kind,
        aggregate,
      }),
    )
    .with(
      [P.string, P.instanceOf(Function), P.nullish],
      ([kind, aggregate, _]) => ({
        kind,
        aggregate,
      }),
    )
    .run();
}

export function lit<T>(value: T) {
  return aggregator("literal", () => {
    return Promise.resolve([`${value}`]);
  });
}

export function flag<
  const Name extends string,
>(
  name: Name,
  flag: string,
) {
  return aggregator(
    "option",
    <any> ((ctx: any) => {
      if (!(name in ctx) || !ctx[name]) {
        return [];
      }

      return Promise.resolve([flag]);
    }),
  );
}
export function option<
  const Name extends string,
  Serializer extends TypeSerializer<any>,
>(
  name: Name,
  serialize: Serializer,
) {
  return aggregator(
    "option",
    <any> ((ctx: any) => {
      if (!(name in ctx)) {
        return [];
      }
      return Promise.resolve(serialize(ctx[name]));
    }),
  );
}

export function argument<
  const Name extends string,
  const Serializer extends TypeSerializer<any>,
>(
  name: Name,
  serialize: Serializer,
  defaultValue?: TypeFromSerializer<Serializer>,
) {
  return aggregator(
    "option",
    <any> ((ctx: any) => {
      if (!(name in ctx) && !defaultValue) {
        throw new Error(`Missing argument: ${name}`);
      }
      return Promise.resolve(serialize(ctx[name] ?? defaultValue));
    }),
  );
}

export function prefix(prefix: string): (value: string) => string[] {
  return (value: string) => [prefix, value];
}

export function equals(gen: (input: string) => string[]) {
  return (value: string) => {
    const values = gen(value);
    return [`${values[0]}=${JSON.stringify(values[1])}`];
  };
}

export function action(...args: (NamedAggregator<any, any> | string)[]) {
  return async function (values?: any) {
    values = values ?? {};
    const all = [] as string[];
    for (const arg of args) {
      if (typeof arg == "string") {
        all.push(arg);
        continue;
      }
      all.push(...await arg.aggregate(values));
    }
    return all;
  };
}

export function cli<Data extends WrapperData>(data: Data): Builder<[], {}> {
  data = {
    ...data,
    argument: data.argument ?? defaultArgumentWrapper,
    option: data.option ?? defaultOptionWrapper,
  };

  return new Builder();
}

export function defaultArgumentWrapper(value: unknown) {
  return Promise.resolve([`${value}`]);
}

export function defaultOptionWrapper(name: string, value: unknown) {
  return Promise.resolve([name, `${value}`]);
}
