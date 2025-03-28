import { escape } from "jsr:@std/regexp@1.0.1/escape";

// Wrappers

export function length(self: string): number {
  return self.length;
}

// Checks

export function isEmpty(self: string): boolean {
  return self.length === 0;
}

export function isBlank(self: string): boolean {
  return self.trim().length === 0;
}

// Upper case

function makeStringGuard<T extends string>(pattern: string) {
  const regex = new RegExp(pattern, "u");
  return function (value: unknown): value is string & T {
    if (typeof value !== "string") {
      return false;
    }
    regex.lastIndex = 0;
    return regex.exec(value) !== null;
  };
}

function makeStringGuards<T extends string>(pattern: string) {
  return {
    checkString: makeStringGuard(`^(\\s|${pattern})*$`),
    checkWord: makeStringGuard(`^${pattern}*$`),
    checkChar: makeStringGuard(`^${pattern}$`),
  };
}

/*
L	  Letter
Lu	Uppercase Letter
Ll	Lowercase Letter
Lt	Titlecase Letter
Lm	Modifier Letter
Lo	Other Letter
M	  Mark
Mn	Non-Spacing Mark
Mc	Spacing Combining Mark
Me	Enclosing Mark
N	  Number
Nd	Decimal Digit Number
Nl	Letter Number
No	Other Number

S	  Symbol
Sm	Math Symbol
Sc	Currency Symbol
Sk	Modifier Symbol
So	Other Symbol
P	  Punctuation
Pc	Connector Punctuation
Pd	Dash Punctuation
Ps	Open Punctuation
Pe	Close Punctuation
Pi	Initial Punctuation
Pf	Final Punctuation
Po	Other Punctuation

Z	  Separator
Zs	Space Separator
Zl	Line Separator
Zp	Paragraph Separator

C	  Other
Cc	Control
Cf	Format
Cs	Surrogate
Co	Private Use
Cn	Unassigned
*/

export const {
  checkString: isLetterString,
  checkWord: isLetterWord,
  checkChar: isLetterChar,
} = makeStringGuards("\\p{L}");

export const {
  checkString: isUpperString,
  checkWord: isUpperWord,
  checkChar: isUpperChar,
} = makeStringGuards("\\p{Lu}");

export const {
  checkString: isLowerString,
  checkWord: isLowerWord,
  checkChar: isLowerChar,
} = makeStringGuards("\\p{Ll}");

export const {
  checkString: isMarkString,
  checkWord: isMarkWord,
  checkChar: isMarkChar,
} = makeStringGuards("\\p{M}");

export const {
  checkString: isNumberString,
  checkWord: isNumberWord,
  checkChar: isNumberChar,
} = makeStringGuards("\\p{N}");

export const {
  checkString: isSymbolString,
  checkWord: isSymbolWord,
  checkChar: isSymbolChar,
} = makeStringGuards("\\p{N}");

export const {
  checkString: isPunctuationString,
  checkWord: isPunctuationWord,
  checkChar: isPunctuationChar,
} = makeStringGuards("\\p{P}");

export const {
  checkString: isSeparatorString,
  checkWord: isSeparatorWord,
  checkChar: isSeparatorChar,
} = makeStringGuards("\\p{Z}");

export const {
  checkString: isOtherString,
  checkWord: isOtherWord,
  checkChar: isOtherChar,
} = makeStringGuards("\\p{C}");

//
//(?<letter>\p{L})|(?<mark>\p{M})|(?<number>\p{N})|(?<symbol>\p{S})|(?<punctuation>\p{P})|(?<separator>\p{Z})|(?<other>\p{C})

// Indentation

export function indent(
  self: string,
  count: number = 1,
  length: number = 2,
  character: string = " ",
): string {
  character = character.slice(0, 1);
  if (character == "") {
    character = " ";
  }

  const padding = character.repeat(length * count);
  return self
    .split("\n")
    .map((line) => padding + line)
    .join("\n");
}

export function unindent(
  self: string,
  tabSize: number = 2,
): string {
  const tab = " ".repeat(tabSize);
  const lines = self
    .split("\n")
    .map((line) => {
      const match = line.match(/^(?<indent>(?:\p{Zs}|\t)*)(?<contents>.*)/u);
      const indent = match?.groups?.indent.replaceAll(/\t/g, tab);
      const size = indent?.length ?? 0;
      const contents = match?.groups?.contents;
      return {
        size,
        indent,
        contents,
      };
    });

  const min = Math.min(
    ...lines.filter(({ contents }) => contents?.length != 0)
      .map((line) => line.size),
  );

  return lines
    .map((line) => {
      const indent = line.indent?.slice(min) ?? "";
      return indent + line.contents;
    })
    .join("\n");
}

// Starts and ends with

export function startsWith(self: string, value: string): boolean {
  return self.startsWith(value);
}

export function endsWith(self: string, value: string): boolean {
  return self.endsWith(value);
}

export function contains(self: string, value: string): boolean {
  return self.includes(value);
}

// Splitting

export function split(str: string, separator: string): string[];
export function split(str: string, separators: string[]): string[];
export function split(str: string, separator: RegExp): string[];
export function split(
  str: string,
  separator: RegExp | string | string[],
): string[] {
  let r: RegExp;
  if (separator instanceof RegExp) {
    r = separator;
  } else if (Array.isArray(separator)) {
    r = new RegExp(separator.map((value) => escape(value) + "+").join("|"));
  } else if (typeof separator === "string") {
    r = new RegExp(escape(separator) + "+");
  } else {
    throw new Error("Invalid delimiter type");
  }

  return str.split(r);
}

export function skip(self: string, length: number): string {
  return self.slice(length);
}

export function take(self: string, length: number): string {
  return self.slice(0, length);
}

export function first(self: string, length: number): string {
  return self.slice(0, length);
}

export function last(self: string, length: number): string {
  return self.slice(-length);
}

export function padLeft(
  self: string,
  length: number,
  fillString?: string,
): string {
  return self.padStart(length, fillString);
}

export function padRight(
  self: string,
  length: number,
  fillString?: string,
): string {
  return self.padEnd(length, fillString);
}

export function join(self: string[], separator?: string): string {
  return self.join(separator);
}

/////////////////////////////////////////////////////////////////////////

export class Token {
  private readonly value: string;
  private readonly acronym: boolean = false;

  constructor(
    value: string,
    acronym?: boolean,
  ) {
    this.value = value;
    if (typeof acronym === "undefined") {
      this.acronym = isUpperString(value);
    } else {
      this.acronym = acronym;
    }
  }

  public toUpper(): Token {
    return new Token(this.value.toUpperCase(), this.acronym);
  }

  public toLower(): Token {
    return new Token(this.value.toLowerCase(), this.acronym);
  }

  public toUpperFirst(): Token {
    if (this.acronym) {
      return new Token(this.value.toUpperCase(), this.acronym);
    } else {
      return new Token(
        this.value.slice(0, 1).toUpperCase() + this.value.slice(1),
        this.acronym,
      );
    }
  }

  public toLowerFirst(): Token {
    if (this.acronym) {
      return new Token(this.value.toLowerCase(), this.acronym);
    } else {
      return new Token(
        this.value.slice(0, 1).toLowerCase() + this.value.slice(1),
        this.acronym,
      );
    }
  }

  public isEmpty(): boolean {
    return this.value.length === 0;
  }

  public isBlank(): boolean {
    return this.value.trim().length === 0;
  }

  public toString(): string {
    return this.value;
  }
}

export class Tokens {
  private readonly prefix: string = "";
  private readonly suffix: string = "";

  public constructor(
    public readonly tokens: Token[],
    public readonly separator?: string,
    prefix?: string,
    suffix?: string,
  ) {
    this.prefix = prefix ?? "";
    this.suffix = suffix ?? "";
  }

  public toJSON(): string {
    return this.toString();
  }

  public toString(): string {
    return this.prefix +
      this.tokens.map((token) => token.toString()).join(this.separator) +
      this.suffix;
  }

  public toSnake(): Tokens {
    return new Tokens(this.tokens.map((token) => token.toLower()), "_");
  }

  public toKebab(): Tokens {
    return new Tokens(this.tokens.map((token) => token.toLower()), "-");
  }

  public toPascal(): Tokens {
    return this.toCapital();
  }

  public toCamel(): Tokens {
    return new Tokens(
      this.tokens.map((token, index) =>
        index == 0 ? token.toLower() : token.toLower().toUpperFirst()
      ),
      "",
    );
  }

  public toConst(): Tokens {
    return new Tokens(
      this.tokens.map((token) => token.toUpper()),
      "_",
    );
  }

  public toTrain(): Tokens {
    return new Tokens(
      this.tokens.map((token) => token.toLower().toUpperFirst()),
      "-",
    );
  }

  public toAda(): Tokens {
    return new Tokens(
      this.tokens.map((token) => token.toLower().toUpperFirst()),
      "_",
    );
  }

  public toCobol(): Tokens {
    return new Tokens(
      this.tokens.map((token) => token.toUpper()),
      "-",
    );
  }

  public toDot(): Tokens {
    return new Tokens(
      this.tokens.map((token) => token),
      ".",
    );
  }

  public toLowerDot(): Tokens {
    return new Tokens(
      this.tokens.map((token) => token.toLower()),
      ".",
    );
  }

  public toPath(): Tokens {
    return new Tokens(this.tokens.map((token) => token), "/");
  }

  public toSpace(): Tokens {
    return new Tokens(this.tokens.map((token) => token), " ");
  }

  public toCapital(): Tokens {
    return new Tokens(
      this.tokens.map((token) => token.toLower().toUpperFirst()),
      "",
    );
  }

  public toCppNamespace(): Tokens {
    return new Tokens(this.tokens.map((token) => token), "::");
  }

  public toSentence(): Tokens {
    return new Tokens(
      this.tokens.map((token, index) =>
        index == 0 ? token.toUpperFirst() : token.toLower()
      ),
      " ",
      "",
      ".",
    );
  }
}

export function tokenize(self: string, separator?: string): Tokens {
  return new Tokens(tokens(self), separator);
}

export function token(self: string, acronym?: boolean): Token {
  return new Token(self, acronym);
}

export function tokens(self: string): Token[] {
  const words = split(
    self,
    /\p{M}|\p{N}|\p{Z}|\p{P}|\p{S}/u,
  );

  return words
    .flatMap((word) => {
      const parts: string[] = [];
      let upper = false;
      let prev_upper = false;
      let next_upper = false;
      let first = true;
      let last = false;
      let current = "";

      for (let i = 0; i < word.length; i++) {
        const character = word[i];

        prev_upper = upper;
        upper = isUpperString(character);
        next_upper = i + 1 < word.length ? isUpperString(word[i + 1]) : false;

        last = i == word.length - 1;
        if (first) {
          first = false;
          current += character;
          continue;
        }

        if (!upper) {
          current += character;
          continue;
        }

        if ((!prev_upper && !first) || (!next_upper && !last)) {
          parts.push(current);
          current = "";
        }

        current += character;
      }

      if (current != "") {
        parts.push(current);
      }

      return parts;
    })
    .map((word) => new Token(word));
}

// Comparisons

export function equals(left: string, right: string): boolean {
  return left === right;
}

// Transformation

export function replaceAll(
  instance: string,
  search: string,
  replacement: string,
): string {
  return instance.replaceAll(search, replacement);
}

export function replace(
  self: string,
  search: string,
  replacement: string,
): string {
  return self.replace(search, replacement);
}
