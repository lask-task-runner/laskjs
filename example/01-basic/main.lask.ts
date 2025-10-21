import { json } from "../../src/DataType/JSON.ts";
import { input, Lask, output, param } from "../../src/Lask.ts";
import { stdin } from "../../src/Reader.ts";
import { stdout } from "../../src/Writer.ts";

const lask = new Lask();

lask.task(
  "create-file",
  {
    filename: param("string"),
    content: input(stdin, json({ type: "string" })),
  },
  {
    output: output(stdout, json({ type: "string" })),
  },
  async ({ filename, content }, effect) => {
    effect.info(`Creating file: ${filename}`);
    effect.info(`With content: ${content}`);
    await Deno.writeTextFile(filename, content);
    return { output: "OK" };
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
