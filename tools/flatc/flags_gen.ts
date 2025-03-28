import vento from "jsr:@vento/vento@1.12.16";
import { match, P } from "npm:ts-pattern@5.6.2";

import { $ } from "jsr:@david/dax@0.42.0";
import { version } from "npm:meriyah@6.0.5";

const versionString = await $`flatc --version`.lines();

const versionMatch = /flatc version (?<version>.*)/g.exec(versionString[0]);
if (!versionMatch) {
  throw new Error("Could not parse flatc version");
}

const version = versionMatch.groups!.version!;

const args = await $`flatc --help`.lines();

type ParsedLine = {
  $: string;
  alias?: string;
  name?: string;
  args: string[];
  description: string[];
};

type Command = {
  source: string[];
  flags: string[];
  arguments: string[];
  description: string[];
};

Object.defineProperty(Array.prototype, "tap", {
  value: function (fn: (value: any) => void) {
    fn(this);
    return this;
  },
});

const commands = args
  .map((line) =>
    ///^ +(?<alias>-[a-z0-9](?:,\s*)?)?(?<name>--[a-z0-9-_]+)?(?<args> \W+)*(?<description>.*)$/gmi
    [
      line,
      /^ {2}(?<alias>-[a-z0-9])?(?:,\s*)?(?<name>--[a-z0-9-_]+)?(?<args>(?: [A-Z]+(?![a-z]))*)*(?<description>.*)$/g
        .exec(line),
    ] as const
  )
  .filter((value): value is [string, RegExpExecArray] => value[1] !== null)
  .map(([_, match]) => match)
  .map((line): ParsedLine => {
    const groups = line.groups ?? {};

    const name = groups.name;
    const alias = groups.alias;
    const args = (groups.args ?? "").trim().split(" ").filter(Boolean);
    const description = [(groups.description ?? "").trim()].filter(Boolean);

    return {
      $: line[0],
      alias,
      name,
      args,
      description,
    };
  })
  .reduce((commands, command) => {
    return match(command)
      .returnType<Command[]>()
      .with(
        {
          $: P.string,
          name: P.string,
          alias: P.string,
          args: P.array(P.string),
          description: P.array(P.string),
        },
        ({ $, name, args, alias, description }) => {
          return commands.concat([{
            source: [$],
            flags: [name, alias],
            arguments: args,
            description: description,
          }]);
        },
      )
      .with(
        {
          $: P.string,
          name: P.string,
          args: P.array(P.string),
          description: P.array(P.string),
        },
        ({ $, name, args, description }) => {
          return commands.concat([{
            source: [$],
            flags: [name],
            arguments: args,
            description,
          }]);
        },
      )
      .with(
        {
          $: P.string,
          args: P.array(P.string),
          description: P.array(P.string),
        },
        ({ $, args, description }) => {
          if (!commands.length) {
            return [];
          }

          commands[commands.length - 1].source = [
            ...commands[commands.length - 1].source,
            $,
          ];

          commands[commands.length - 1].arguments = [
            ...commands[commands.length - 1].arguments,
            ...args,
          ];

          commands[commands.length - 1].description = [
            ...commands[commands.length - 1].description,
            ...description,
          ];

          return commands;
        },
      )
      .exhaustive();
  }, [] as Command[])
  .map((command) => {
    const name_tokens = command.flags.sort()[0].replace(/^-{1,2}/, "").split(
      "-",
    );
    const name_snake = name_tokens.map((v) => v.toLowerCase()).join("_");
    const name_pascal = name_tokens.map((v) =>
      v[0].toUpperCase() + v.slice(1).toLowerCase()
    ).join("");
    const name_camel = name_pascal[0].toLowerCase() + name_pascal.slice(1);

    console.log(command);
    return {
      name_snake,
      name_camel,
      name_pascal,
      ...command,
    };
  });

const env = vento();

const code = await env.runString(
  /* vento */ `
import { define } from "../../tool/flags.ts";

export const FlatcFlags = define({
{{- for command of commands }}
  {{ command.name_camel }}: (
    {{- for argument of command.arguments -}}
      {{ argument }}: string,
    {{- /for -}}
  ) => ["{{ command.flags[0] }}",
    {{- for argument of command.arguments -}}
      {{ argument }},
    {{- /for -}}
    ],
{{- /for}}
});
`,
  { commands },
);

Deno.writeTextFile(
  `${import.meta.dirname ?? "."}/versions/v${version}.ts`,
  code.content,
);
