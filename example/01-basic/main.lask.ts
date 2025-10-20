import { JSONOutput } from "../../src/DataType/JSON.ts";
import { Lask } from "../../src/Lask.ts";

const lask = new Lask();

lask.task(
  "add",
  {
    param: {
      a: { type: "number", description: "First number" },
      b: { type: "number", description: "Second number" },
    },
    output: JSONOutput({ type: "number" }),
  },
  ({ a, b }, _input, effect) => {
    effect.info(`Adding two numbers: ${a} ${b}`);
    return Promise.resolve(a + b);
  },
);

lask.task("ls", {}, async (_param, _input, effect) => {
  effect.info("Listing current directory contents");
  await effect.$("ls -la");
});

await lask.bite();
