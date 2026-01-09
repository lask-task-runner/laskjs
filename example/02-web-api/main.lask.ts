import { Docker } from "../../src/environment/docker.ts";
import { Lask } from "../../src/lask.ts";

const lask = new Lask();

lask.task("serve", {
  options: {
    prompt: new Docker({
      image: "golang:1.20",
      ports: { "8080/tcp": "8080" },
    }),
  },
  handler: async (_input, effect) => {
    effect.info("Starting Go web server...");
    await effect.runPrompt("go run main.go");
  },
});

await lask.bite();
