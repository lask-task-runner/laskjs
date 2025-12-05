import { json } from "../../src/Codec/JSON.ts";
import { raw, stringify } from "../../src/Codec/String.ts";
import { arg } from "../../src/IO/Command.ts";
import { stdin, stdout } from "../../src/IO/Console.ts";
import { file } from "../../src/IO/File.ts";
import { Lask } from "../../src/Lask.ts";

const lask = new Lask();

lask.task("write-file", {
  input: {
    type: "string",
    from: {
      decoder: raw,
      reader: stdin,
    },
  },
  output: {
    type: "string",
    to: {
      encoder: raw,
      writer: file("output.txt"),
    },
  },
  handler: (content, effect) => {
    effect.info(`With content: ${content}`);
    return Promise.resolve(content);
  },
});

lask.task("add", {
  input: {
    type: "object",
    properties: {
      a: {
        type: "number",
        from: {
          reader: arg(0),
          decoder: json<number>(),
        },
      },
      b: {
        type: "number",
        from: {
          reader: arg(1),
          decoder: json<number>(),
        },
      },
    },
  },
  output: {
    type: "number",
    to: {
      encoder: stringify,
      writer: stdout,
    },
  },
  handler: ({ a, b }, effect) => {
    effect.info(`Adding two numbers: ${a} ${b}`);
    return Promise.resolve(a + b);
  },
});

lask.task("ls", {
  handler: async (_inputs, effect) => {
    effect.info("Listing current directory contents");
    await effect.$("ls -la");
    return {};
  },
});

await lask.bite();
