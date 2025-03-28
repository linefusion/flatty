import { $ } from "jsr:@david/dax@0.42.0";

export type Flags = {
  [name: string]: (...args: string[]) => string[];
};

const With = Symbol.for("flatty.flagbuilder.with");
const Flags = Symbol.for("flatty.flagbuilder.flags");
const Values = Symbol.for("flatty.flagbuilder.values");
const Result = Symbol.for("flatty.flatbuilder.result");

export type Map<T extends Flags = Flags> = {
  [K in keyof T]: (...args: Parameters<T[K]>) => Map<Omit<T, K>>;
};

export class Builder<T extends Flags = Flags> {
  private [Flags]: T = {} as T;
  private [Values]: string[] = [];

  constructor(flags: T) {
    this[Flags] = flags;
  }

  [With]<K extends keyof T>(
    key: K,
    ...args: Parameters<T[K]>
  ): Builder<Omit<T, K>> {
    this[Values].push(...this[Flags][key](...args));
    return this;
  }

  [Result](): string[] {
    return this[Values];
  }
}

export function define<T extends Flags>(value: T): T {
  return value;
}

export function result<T extends Flags>(flags?: Map<T>): string[] {
  if (!flags) {
    return [];
  }
  return (flags as Builder<Flags>)[Result]();
}

export function create<T extends Flags>(value: T): Map<T> {
  const builder = new Builder(value);
  const used: (keyof T)[] = [];

  const proxy = new Proxy(builder, {
    has(target, property) {
      return (property in target) && !used.some((key) => key === property);
    },
    get(target, property: keyof typeof builder) {
      if (property in target) {
        return target[property];
      }
      return <K extends keyof T>(...args: Parameters<T[K]>) => {
        target[With](property as keyof T, ...args);
        used.push(property as keyof T);
        return proxy;
      };
    },
  });

  return proxy as Map<T>;
}
