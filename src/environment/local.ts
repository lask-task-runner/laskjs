import { PromptResult, SingletonPrompt, StatelessPrompt } from "../lask.ts";
import { Logger } from "../logger.ts";

export class Local implements SingletonPrompt, StatelessPrompt {
  private logger: Logger;
  private promptFunc: ((script: string) => Promise<PromptResult>) | null = null;

  constructor() {
    this.logger = new Logger("Local#sh");
  }

  getPrompt(): (script: string) => Promise<PromptResult> {
    if (!this.promptFunc) {
      this.promptFunc = async (script: string): Promise<PromptResult> => {
        const command = new Deno.Command("sh", {
          args: ["-c", script],
          stdout: "piped",
          stderr: "piped",
        });

        const child = command.spawn();
        const output = await child.output();

        const stdout = new TextDecoder().decode(output.stdout);
        const stderr = new TextDecoder().decode(output.stderr);
        const code = output.code;

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

        return { stdout, stderr, code };
      };
    }
    return this.promptFunc;
  }

  async onetimePrompt(script: string): Promise<PromptResult> {
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
    const code = output.code;

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

    return { stdout, stderr, code };
  }
}
