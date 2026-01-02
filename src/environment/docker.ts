import { PromptResult, StatefulPrompt, StatelessPrompt } from "../lask.ts";
import { Logger } from "../logger.ts";

interface ContainerInfo {
  containerId: string;
  promptFunc: (script: string) => Promise<PromptResult>;
}

export class Docker implements StatefulPrompt, StatelessPrompt {
  private image: string;
  private workDir: string;
  private autoRemove: boolean;
  private mountVolume: boolean;
  private ports?: Record<string, string>;
  private logger: Logger;
  private containers: ContainerInfo[] = [];

  constructor(options: {
    image: string;
    workDir?: string;
    autoRemove?: boolean;
    mountVolume?: boolean;
    ports?: Record<string, string>;
  }) {
    this.image = options.image;
    this.workDir = options.workDir || "/workspace";
    this.autoRemove = options.autoRemove ?? true;
    this.mountVolume = options.mountVolume ?? true;
    this.ports = options.ports;
    this.logger = new Logger(`Docker#${this.image}`);
  }

  /**
   * Create a new container
   */
  private async createContainer(): Promise<string> {
    // Build docker run command
    const args = [
      "run",
      "-d", // detached mode
      "-w",
      this.workDir, // working directory
    ];

    // Add volume mount
    if (this.mountVolume) {
      args.push("-v", `${Deno.cwd()}:${this.workDir}`);
    }

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
    const containerId = new TextDecoder().decode(output.stdout).trim();
    this.logger.debug(`Container created: ${containerId}`);

    return containerId;
  }

  async newPrompt(): Promise<(script: string) => Promise<PromptResult>> {
    const containerId = await this.createContainer();

    const promptFunc = async (script: string): Promise<PromptResult> => {
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
    };

    this.containers.push({ containerId, promptFunc });
    return promptFunc;
  }

  async cleanupAllPrompts(): Promise<void> {
    for (const container of this.containers) {
      try {
        this.logger.debug(`Stopping container: ${container.containerId}`);

        // Stop the container
        const stopCommand = new Deno.Command("docker", {
          args: ["stop", container.containerId],
          stdout: "piped",
          stderr: "piped",
        });
        await stopCommand.output();

        // Remove container if not auto-remove
        if (!this.autoRemove) {
          const rmCommand = new Deno.Command("docker", {
            args: ["rm", container.containerId],
            stdout: "piped",
            stderr: "piped",
          });
          await rmCommand.output();
        }

        this.logger.debug(`Container stopped: ${container.containerId}`);
      } catch (error) {
        this.logger.error(`Failed to stop container: ${error}`);
      }
    }
    this.containers = [];
  }

  async onetimePrompt(script: string): Promise<PromptResult> {
    // Build docker run command with --rm for automatic cleanup
    const args = [
      "run",
      "--rm", // automatically remove container when it exits
      "-w",
      this.workDir, // working directory
    ];

    // Add volume mount
    if (this.mountVolume) {
      args.push("-v", `${Deno.cwd()}:${this.workDir}`);
    }

    // Add port mappings
    if (this.ports) {
      for (const [containerPort, hostPort] of Object.entries(this.ports)) {
        args.push("-p", `${hostPort}:${containerPort}`);
      }
    }

    // Add image and command
    args.push(this.image, "sh", "-c", script);

    // Execute command directly
    const command = new Deno.Command("docker", {
      args,
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
  }
}
