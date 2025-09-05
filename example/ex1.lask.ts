import { Lask } from "../src/Lask.ts";

const lask: Lask = new Lask();

lask.task("add", (input: number[], effect) => {
  effect.info(`Adding numbers [${input.join(", ")}]`);
  return Promise.resolve(input.reduce((a, b) => a + b, 0));
});

lask.task("ls", async (_, effect) => {
  effect.info("Listing current directory contents");
  await effect.$("ls -la");
  return null;
});

await lask.bite();
