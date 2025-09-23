import { Lask } from "../src/Lask.ts";

const lask: Lask = new Lask();

lask.task(
  "add",
  { type: "array", elements: { type: "number" } },
  { type: "number" },
  (input, effect) => {
    effect.info(`Adding numbers [${input.join(", ")}]`);
    return Promise.resolve(input.reduce((a, b) => a + b, 0));
  },
);

lask.task("ls", { type: "void" }, { type: "void" }, async (_, effect) => {
  effect.info("Listing current directory contents");
  await effect.$("ls -la");
});

await lask.bite();
