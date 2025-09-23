import { Lask } from "../src/Lask.ts";

const lask: Lask = new Lask();

lask.task(
  "add",
  {
    parameters: {
      a: { type: "number", description: "First number" },
      b: { type: "number", description: "Second number" },
    },
    // input: { type: "array", elements: { type: "number" } },
    output: { type: "number" },
    handler: ({ a, b }, _input, effect) => {
      effect.info(`a: ${a}, b: ${b}`);
      return Promise.resolve(a + b);
    },
  },
);

lask.task("ls", {
  handler: async (params, _, effect) => {
    effect.info("Listing current directory contents");
    await effect.$("ls -la");
  },
});

await lask.bite();
