import { Environment, Prompt, PromptResult } from "../lask.ts";
import { Logger } from "../logger.ts";

export class Docker implements Environment {
  private containerId?: string;
  private image: string;
  private workDir: string;
  private autoRemove: boolean;
  private ports?: Record<string, string>;
  private logger: Logger;

  constructor(options: {
    image: string;
    workDir?: string;
    autoRemove?: boolean;
    ports?: Record<string, string>;
  }) {
    this.image = options.image;
    this.workDir = options.workDir || "/workspace";
    this.autoRemove = options.autoRemove ?? true;
    this.ports = options.ports;
    this.logger = new Logger(`Docker#${this.image}`);
  }

  /**
   * Ensure container is running
   */
  private async ensureContainer(): Promise<string> {
    if (this.containerId) {
      return this.containerId;
    }

    // Build docker run command
    const args = [
      "run",
      "-d", // detached mode
      "-w",
      this.workDir, // working directory
      "-v",
      `${Deno.cwd()}:${this.workDir}`, // mount current directory
    ];

    // Add auto-remove flag
    if (this.autoRemove) {
      args.push("--rm");
    }

    // Add port mappings
    if (this.ports) {
      for (const [containerPort, hostPort] of Object.entries(this.ports)) {
        args.push("-p", `${hostPort}:${containerPort}`);
      }
    }

    // Add image and command
    args.push(this.image, "sleep", "infinity");

    // Create and start container
    const command = new Deno.Command("docker", {
      args,
      stdout: "piped",
      stderr: "piped",
    });

    const child = command.spawn();
    const output = await child.output();

    if (output.code !== 0) {
      const stderr = new TextDecoder().decode(output.stderr);
      throw new Error(`Failed to create container: ${stderr}`);
    }

    // Container ID is in stdout
    this.containerId = new TextDecoder().decode(output.stdout).trim();

    return this.containerId;
  }

  openPrompt(): Prompt {
    return {
      id: "docker-prompt",
      $: async (script: string): Promise<PromptResult> => {
        const containerId = await this.ensureContainer();

        // Execute command in container using docker exec
        const command = new Deno.Command("docker", {
          args: ["exec", containerId, "sh", "-c", script],
          stdout: "piped",
          stderr: "piped",
        });

        const child = command.spawn();
        const output = await child.output();

        const stdout = new TextDecoder().decode(output.stdout);
        const stderr = new TextDecoder().decode(output.stderr);
        const code = output.code;

        if (code !== 0) {
          this.logger.error(`Command failed with exit code ${code}: ${stderr}`);
          throw new Error(stderr);
        }

        // Log each line of output
        stdout.split("\n").forEach((line) => {
          if (line.trim()) {
            this.logger.debug(line);
          }
        });

        return { stdout, stderr, code };
      },
    };
  }

  closePrompt(_prompt: Prompt): void {
    // Cleanup will be handled separately if needed
  }

  /**
   * Stop and remove the container
   */
  async cleanup(): Promise<void> {
    if (this.containerId) {
      try {
        // Stop the container
        const stopCommand = new Deno.Command("docker", {
          args: ["stop", this.containerId],
          stdout: "piped",
          stderr: "piped",
        });
        await stopCommand.output();

        // Remove container if not auto-remove
        if (!this.autoRemove) {
          const rmCommand = new Deno.Command("docker", {
            args: ["rm", this.containerId],
            stdout: "piped",
            stderr: "piped",
          });
          await rmCommand.output();
        }
      } finally {
        this.containerId = undefined;
      }
    }
  }
}
