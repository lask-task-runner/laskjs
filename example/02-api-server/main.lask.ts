import { Lask } from "../../src/lask.ts";

const lask = new Lask();

lask.task("init", {
  handler: async (_input, effect) => {
    effect.info("Initializing Go API server project");

    // Create go.mod
    await effect.$("go mod init example/api-server");

    effect.info("Project initialized successfully");
  },
});

lask.task("build", {
  handler: async (_input, effect) => {
    effect.info("Building Go API server");

    await effect.$("go build -o bin/server main.go");

    effect.info("Build completed successfully");
  },
});

lask.task("run", {
  handler: async (_input, effect) => {
    effect.info("Starting Go API server on :8080");

    await effect.$("go run main.go");
  },
});

lask.task("test", {
  handler: async (_input, effect) => {
    effect.info("Running tests");

    await effect.$("go test -v ./...");

    effect.info("Tests completed");
  },
});

await lask.bite();
