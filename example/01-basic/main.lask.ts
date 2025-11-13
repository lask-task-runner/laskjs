import { json } from "../../src/Codec/JSON.ts";
import { string } from "../../src/Codec/String.ts";
import { stdin, stdout } from "../../src/IO/Console.ts";
import { file } from "../../src/IO/File.ts";
import { input, Lask, option, output } from "../../src/Lask.ts";

const lask = new Lask();

lask.task({
  name: "write-file",
  input: {
    content: input(stdin, string("Input content to write to file")),
  },
  output: {
    file: output(file("output.txt"), string("Output file content")),
  },
  handler: ({ content }, effect) => {
    effect.info(`With content: ${content}`);
    return Promise.resolve({ file: content });
  },
});

lask.task({
  name: "add",
  input: {
    a: option({ type: "number", long: "a", short: "a" }),
    b: option({ type: "number", long: "b", short: "b" }),
  },
  output: {
    output: output(stdout, json({ type: "number" })),
  },
  handler: ({ a, b }, effect) => {
    effect.info(`Adding two numbers: ${a} ${b}`);
    return Promise.resolve({ output: a + b });
  },
});

lask.task({
  name: "ls",
  handler: async (_inputs, effect) => {
    effect.info("Listing current directory contents");
    await effect.$("ls -la");
    return {};
  },
});

await lask.bite();
