import { Lask } from "../src/Lask.ts";

const lask: Lask = new Lask();

lask.task("add", (input: number[], effect) => {
  effect.log(`Adding numbers [${input.join(", ")}]`);
  return input.reduce((a, b) => a + b, 0);
});

lask.bite();
