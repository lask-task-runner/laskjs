import { string } from "../../src/Codec/String.ts";
import { stdin, stdout } from "../../src/IO/Console.ts";
import { file } from "../../src/IO/File.ts";
import { input, Lask, option } from "../../src/Lask.ts";

const lask = new Lask();

lask.task("write-file", {
  input: {
    type: "object",
    properties: {
      content: { type: "string", from: input(stdin, string("Input content to write to file")) },
    },
  },
  output: {
    type: "string",
    to: file("output.txt"),
  },
  handler: ({ content }, effect) => {
    effect.info(`With content: ${content}`);
    return Promise.resolve(content);
  },
});

lask.task("add", {
  input: {
    type: "object",
    properties: {
      a: { type: "number", from: option({ type: "number" }, { long: "a", short: "a" }) },
      b: { type: "number", from: option({ type: "number" }, { long: "b", short: "b" }) },
    },
  },
  output: {
    type: "number",
    to: stdout,
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
