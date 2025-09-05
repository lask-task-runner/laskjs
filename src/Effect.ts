import { LaskLogger } from "./LaskLogger.ts";

export class Effect {
  public logger: LaskLogger;

  constructor(name: string) {
    this.logger = new LaskLogger(name);
  }

  /**
   * Execute a shell command and return its stdout as a string.
   * Logs stdout and stderr appropriately.
   * Throws an error if the command exits with a non-zero status.
   */
  async $(script: string): Promise<string> {
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
      this.error(`Command failed with exit code ${output.code}: ${stderr}`);
      throw new Error(stderr);
    }

    // Log each line of output
    stdout.split("\n").forEach((line) => {
      if (line.trim()) {
        this.debug(line);
      }
    });

    return stdout;
  }

  /**
   * Log info message
   */
  // deno-lint-ignore no-explicit-any
  info(message: any): void {
    this.logger.info(message);
  }

  /**
   * Log debug message
   */
  // deno-lint-ignore no-explicit-any
  debug(message: any): void {
    this.logger.debug(message);
  }

  /**
   * Log warning message
   */
  // deno-lint-ignore no-explicit-any
  warn(message: any): void {
    this.logger.warn(message);
  }

  /**
   * Log error message
   */
  // deno-lint-ignore no-explicit-any
  error(message: any): void {
    this.logger.error(message);
  }
}
