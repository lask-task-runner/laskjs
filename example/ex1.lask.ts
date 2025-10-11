import { JSONSignature } from "../src/DataType/JSON.ts";
import { Lask } from "../src/Lask.ts";

const lask = new Lask();

lask.task(
  "add",
  JSONSignature({
    input: { type: "array", elements: { type: "number" } },
    output: { type: "number" },
  }),
  (ns, effect) => {
    effect.info(`Adding numbers: [${ns.join(", ")}]`);
    return Promise.resolve(ns.reduce((a, b) => a + b, 0));
  },
);

lask.task("ls", JSONSignature({}), async (_input, effect) => {
  effect.info("Listing current directory contents");
  await effect.$("ls -la");
});

await lask.bite();
