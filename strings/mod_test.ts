import { expect } from "jsr:@std/expect@1.0.14";

import { Token, Tokens } from "./mod.ts";
import * as str from "./mod.ts";

Deno.test("strings.tokens", () => {
  const tests = [
    ["a", "a"],
    ["A", "A"],
    ["aa", "aa"],
    ["AA", "AA"],
    ["Aa", "Aa"],
    ["aA", "a", "A"],

    ["hello_world", "hello", "world"],
    ["hello world", "hello", "world"],
    ["HelloWorld", "Hello", "World"],
    ["helloWorld", "hello", "World"],
    ["hello-world", "hello", "world"],
    ["hello--world", "hello", "world"],
    ["hello__world", "hello", "world"],
    ["HELLOWorld", "HELLO", "World"],
    ["isBlankSpaces", "is", "Blank", "Spaces"],
    ["IServerHandlerInterface", "I", "Server", "Handler", "Interface"],
    ["some::cpp::namespace", "some", "cpp", "namespace"],
    ["Some.CS.Namespace", "Some", "CS", "Namespace"],
  ];

  for (const [input, ...expected] of tests) {
    expect(str.tokens(input).map((token) => token.toString())).toEqual(
      expected,
    );
  }

  expect(str.tokens("FairyGUI").map((token) => token.toString())).toEqual([
    "Fairy",
    "GUI",
  ]);
});

Deno.test("strings.tokenize", () => {
  expect(str.tokenize("FairyGUI").tokens).toEqual([
    new Token("Fairy", false),
    new Token("GUI", true),
  ]);
});

Deno.test("token.toLower", () => {
  expect(str.token("hello").toLower().toString()).toBe("hello");
  expect(str.token("HELLO").toLower().toString()).toBe("hello");
  expect(str.token("Hello").toLower().toString()).toBe("hello");
  expect(str.token("HeLlO").toLower().toString()).toBe("hello");
});

Deno.test("token.toLowerFirst", () => {
  expect(str.token("hello").toLowerFirst().toString()).toBe("hello");
  expect(str.token("Hello").toLowerFirst().toString()).toBe("hello");
  expect(str.token("HeLlO").toLowerFirst().toString()).toBe("heLlO");

  // acronym
  expect(str.token("HELLO").toLowerFirst().toString()).toBe("hello");
});

Deno.test("token.toUpper", () => {
  expect(str.token("hello").toUpper().toString()).toBe("HELLO");
  expect(str.token("HELLO").toUpper().toString()).toBe("HELLO");
  expect(str.token("Hello").toUpper().toString()).toBe("HELLO");
  expect(str.token("HeLlO").toUpper().toString()).toBe("HELLO");
});

Deno.test("token.toUpperFirst", () => {
  expect(str.token("hello").toUpperFirst().toString()).toBe("Hello");
  expect(str.token("Hello").toUpperFirst().toString()).toBe("Hello");
  expect(str.token("HeLlO").toUpperFirst().toString()).toBe("HeLlO");

  // acronym
  expect(str.token("HELLO").toUpperFirst().toString()).toBe("HELLO");
});

Deno.test("token.toUpper.toLowerFirst", () => {
  expect(str.token("hello").toUpper().toLowerFirst().toString()).toBe("hELLO");
  expect(str.token("Hello").toUpper().toLowerFirst().toString()).toBe("hELLO");
  expect(str.token("HeLlO").toUpper().toLowerFirst().toString()).toBe("hELLO");

  // acronym
  expect(str.token("HELLO").toUpper().toLowerFirst().toString()).toBe("hello");
});

Deno.test("token.toLower.toUpperFirst", () => {
  expect(str.token("hello").toLower().toUpperFirst().toString()).toBe("Hello");
  expect(str.token("Hello").toLower().toUpperFirst().toString()).toBe("Hello");
  expect(str.token("HeLlO").toLower().toUpperFirst().toString()).toBe("Hello");

  // acronym
  expect(str.token("HELLO").toLower().toUpperFirst().toString()).toBe("HELLO");
});

Deno.test("strings.length", () => {
  expect(str.length("")).toBe(0);
  expect(str.length("a")).toBe(1);
  expect(str.length("ab")).toBe(2);
  expect(str.length("abc")).toBe(3);
});

Deno.test("strings.isEmpty", () => {
  expect(str.isEmpty("")).toBe(true);
  expect(str.isEmpty(" ")).toBe(false);
  expect(str.isEmpty("\t")).toBe(false);
  expect(str.isEmpty("\r")).toBe(false);
  expect(str.isEmpty("\n")).toBe(false);
  expect(str.isEmpty("\r\n")).toBe(false);
});

Deno.test("strings.isBlank", () => {
  expect(str.isBlank("")).toBe(true);
  expect(str.isBlank(" ")).toBe(true);
  expect(str.isBlank("\t")).toBe(true);
  expect(str.isBlank("\r")).toBe(true);
  expect(str.isBlank("\n")).toBe(true);
  expect(str.isBlank("\r\n")).toBe(true);
  expect(str.isBlank("\r\n")).toBe(true);

  expect(str.isBlank("a")).toBe(false);
  expect(str.isBlank("a ")).toBe(false);
  expect(str.isBlank("a\t")).toBe(false);
  expect(str.isBlank("a\r")).toBe(false);
  expect(str.isBlank("a\n")).toBe(false);
  expect(str.isBlank("a\r\n")).toBe(false);
  expect(str.isBlank("a\r\n")).toBe(false);

  expect(str.isBlank("a")).toBe(false);
  expect(str.isBlank(" a")).toBe(false);
  expect(str.isBlank("\ta")).toBe(false);
  expect(str.isBlank("\ra")).toBe(false);
  expect(str.isBlank("\na")).toBe(false);
  expect(str.isBlank("\r\na")).toBe(false);
  expect(str.isBlank("\r\na")).toBe(false);
});

Deno.test("strings.isLetter*", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.isUpper*", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.isLower*", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.isMark*", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.isNumber*", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.isSymbol*", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.isPunctuation*", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.isSeparator*", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.isOther*", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.startsWith", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.endsWith", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.contains", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.split", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.equals", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.replaceAll", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.replace", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.toLowerCase", () => {
  throw new Error("Not implemented");
});

Deno.test("strings.toUpperCase", () => {
  throw new Error("Not implemented");
});

/*
void trim_left(std::string &s);
void trim_left(std::string &s, std::string chars);
void trim_right(std::string &s);
void trim_right(std::string &s, std::string chars);
void trim(std::string &s);
void trim(std::string &s, std::string &chars);

std::string trim_left_copy(std::string s);
std::string trim_left_copy(std::string s, std::string chars);
std::string trim_right_copy(std::string s);
std::string trim_right_copy(std::string s, std::string chars);
std::string trim_copy(std::string s);
std::string trim_copy(std::string s, std::string chars);

template <typename T>
export function toHex(self: string): string {
  return join(
    toTokens(self).map((token) => {
      return token;
    })
  );
}
  std::stringstream stream;
  stream << std::setfill(fill.length() > 0 ? fill.at(0) : '0') << std::setw(size) << std::hex << v;
  return prefix + stream.str();
}

std::vector<std::string> parse_tags(std::string value, char delimiter = ',');
*/
