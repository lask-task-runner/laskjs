import { Docker as DockerAPI } from "node-docker-api";
import { Buffer } from "node:buffer";
import type { Readable } from "node:stream";
import { Environment, Prompt, PromptResult } from "../lask.ts";
import { Logger } from "../logger.ts";

/**
 * Docker API client using Unix socket via node-docker-api
 */
class DockerClient {
  private docker: DockerAPI;

  constructor(socketPath: string = "/var/run/docker.sock") {
    this.docker = new DockerAPI({ socketPath });
  }

  /**
   * List containers
   */
  async listContainers(all = false): Promise<Container[]> {
    const containers = await this.docker.container.list({ all });
    // deno-lint-ignore no-explicit-any
    return containers.map((c: any) => ({
      Id: c.data.Id,
      Names: c.data.Names,
      Image: c.data.Image,
      State: c.data.State,
      Status: c.data.Status,
      Created: c.data.Created,
    }));
  }

  /**
   * Create a container
   */
  async createContainer(config: ContainerConfig): Promise<{ Id: string }> {
    const container = await this.docker.container.create(config);
    return { Id: container.id };
  }

  /**
   * Start a container
   */
  async startContainer(id: string): Promise<void> {
    const container = this.docker.container.get(id);
    await container.start();
  }

  /**
   * Stop a container
   */
  async stopContainer(id: string, timeout = 10): Promise<void> {
    const container = this.docker.container.get(id);
    await container.stop({ t: timeout });
  }

  /**
   * Remove a container
   */
  async removeContainer(id: string, force = false): Promise<void> {
    const container = this.docker.container.get(id);
    await container.delete({ force });
  }

  /**
   * Execute a command in a container
   */
  async exec(
    containerId: string,
    cmd: string[],
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const container = this.docker.container.get(containerId);

    // Create exec instance
    const exec = await container.exec.create({
      AttachStdout: true,
      AttachStderr: true,
      Cmd: cmd,
    });

    // Start exec and capture output
    const stream = await exec.start({ Detach: false }) as unknown as Readable;

    let stdout = "";
    let stderr = "";

    // Collect output from stream
    await new Promise<void>((resolve, reject) => {
      // deno-lint-ignore no-explicit-any
      (stream as any).on("data", (chunk: Buffer) => {
        const data = chunk.toString();
        // Docker multiplexes stdout/stderr, first byte indicates stream type
        // 1 = stdout, 2 = stderr
        const streamType = chunk[0];
        const content = chunk.slice(8).toString(); // Skip 8-byte header

        if (streamType === 1) {
          stdout += content;
        } else if (streamType === 2) {
          stderr += content;
        } else {
          // Fallback if no header
          stdout += data;
        }
      });
      // deno-lint-ignore no-explicit-any
      (stream as any).on("end", resolve);
      // deno-lint-ignore no-explicit-any
      (stream as any).on("error", reject);
    });

    // Get exit code
    const inspect = await exec.status();
    // deno-lint-ignore no-explicit-any
    const exitCode = (inspect.data as any).ExitCode || 0;

    return { stdout, stderr, exitCode };
  }

  /**
   * Get Docker version info
   */
  async version(): Promise<unknown> {
    return await this.docker.version();
  }

  /**
   * Ping Docker daemon
   */
  async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }
}

export interface Container {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Created: number;
}

export interface ContainerConfig {
  Image: string;
  Cmd?: string[];
  Env?: string[];
  WorkingDir?: string;
  AttachStdout?: boolean;
  AttachStderr?: boolean;
  HostConfig?: {
    Binds?: string[];
    AutoRemove?: boolean;
    PortBindings?: Record<string, Array<{ HostPort: string }>>;
  };
  ExposedPorts?: Record<string, Record<string, never>>;
}

export class DockerEnvironment implements Environment {
  private client: DockerClient;
  private containerId?: string;
  private image: string;
  private workDir: string;
  private autoRemove: boolean;
  private ports?: Record<string, string>;
  private logger: Logger;

  constructor(options: {
    image: string;
    workDir?: string;
    socketPath?: string;
    autoRemove?: boolean;
    ports?: Record<string, string>;
    logger: Logger;
  }) {
    this.client = new DockerClient(options.socketPath);
    this.image = options.image;
    this.workDir = options.workDir || "/workspace";
    this.autoRemove = options.autoRemove ?? true;
    this.ports = options.ports;
    this.logger = options.logger;
  }

  /**
   * Ensure container is running
   */
  private async ensureContainer(): Promise<string> {
    if (this.containerId) {
      return this.containerId;
    }

    // Prepare port bindings if ports are specified
    const portBindings: Record<string, Array<{ HostPort: string }>> = {};
    const exposedPorts: Record<string, Record<string, never>> = {};

    if (this.ports) {
      for (const [containerPort, hostPort] of Object.entries(this.ports)) {
        const portKey = containerPort.includes("/") ? containerPort : `${containerPort}/tcp`;
        portBindings[portKey] = [{ HostPort: hostPort }];
        exposedPorts[portKey] = {};
      }
    }

    // Create container
    const created = await this.client.createContainer({
      Image: this.image,
      Cmd: ["sleep", "infinity"], // Keep container running
      WorkingDir: this.workDir,
      AttachStdout: true,
      AttachStderr: true,
      ExposedPorts: Object.keys(exposedPorts).length > 0 ? exposedPorts : undefined,
      HostConfig: {
        AutoRemove: this.autoRemove,
        Binds: [`${Deno.cwd()}:${this.workDir}`],
        PortBindings: Object.keys(portBindings).length > 0 ? portBindings : undefined,
      },
    });

    this.containerId = created.Id;

    // Start container
    await this.client.startContainer(this.containerId);

    return this.containerId;
  }

  openPrompt(): Prompt {
    return {
      id: "docker-prompt",
      $: async (script: string): Promise<PromptResult> => {
        const containerId = await this.ensureContainer();

        const result = await this.client.exec(containerId, [
          "sh",
          "-c",
          script,
        ]);

        const { stdout, stderr, exitCode } = result;

        if (exitCode !== 0) {
          this.logger.error(`Command failed with exit code ${exitCode}: ${stderr}`);
          throw new Error(stderr);
        }

        // Log each line of output
        stdout.split("\n").forEach((line) => {
          if (line.trim()) {
            this.logger.debug(line);
          }
        });

        return { stdout, stderr, code: exitCode };
      },
    };
  }

  closePrompt(): void {
    // Cleanup will be handled separately if needed
  }

  /**
   * Stop and remove the container
   */
  async cleanup(): Promise<void> {
    if (this.containerId) {
      try {
        await this.client.stopContainer(this.containerId);
        if (!this.autoRemove) {
          await this.client.removeContainer(this.containerId);
        }
      } finally {
        this.containerId = undefined;
      }
    }
  }
}
