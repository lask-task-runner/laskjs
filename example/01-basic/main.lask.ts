import { json } from "../../src/Codec/JSON.ts";
import { string } from "../../src/Codec/String.ts";
import { stdin, stdout } from "../../src/IO/Console.ts";
import { file } from "../../src/IO/File.ts";
import { input, Lask, output, param } from "../../src/Lask.ts";

const lask = new Lask();

lask.task(
  "write-file",
  {
    content: input(stdin, string("Input content to write to file")),
  },
  {
    file: output(file("output.txt"), string("Output file content")),
  },
  ({ content }, effect) => {
    effect.info(`With content: ${content}`);
    return Promise.resolve({ file: content });
  },
);

lask.task(
  "add",
  {
    a: param("number"),
    b: param("number"),
  },
  {
    output: output(stdout, json({ type: "number" })),
  },
  ({ a, b }, effect) => {
    effect.info(`Adding two numbers: ${a} ${b}`);
    return Promise.resolve({ output: a + b });
  },
);

lask.task("ls", {}, {}, async (_inputs, effect) => {
  effect.info("Listing current directory contents");
  await effect.$("ls -la");
  return {};
});

await lask.bite();
