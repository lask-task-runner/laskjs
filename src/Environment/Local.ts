import { Environment } from "../Lask.ts";
import { Logger } from "../Logger.ts";

export class LocalEnvironment implements Environment {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async $(script: string): Promise<string> {
    // Implementation for executing script in local environment
    const command = new Deno.Command("sh", {
      args: ["-c", script],
      stdout: "piped",
      stderr: "piped",
    });

    const child = command.spawn();
    const output = await child.output();

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    if (output.code !== 0) {
      this.logger.error(`Command failed with exit code ${output.code}: ${stderr}`);
      throw new Error(stderr);
    }

    // Log each line of output
    stdout.split("\n").forEach((line) => {
      if (line.trim()) {
        this.logger.debug(line);
      }
    });

    return stdout;
  }
}
