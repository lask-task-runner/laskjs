import { LocalEnvironment } from "./Environment/Local.ts";
import { Environment } from "./Lask.ts";
import { Logger } from "./Logger.ts";

export class Effect {
  public logger: Logger;
  private environment?: Environment;

  constructor(name: string, environment?: Environment) {
    this.logger = new Logger(name);
    this.environment = environment ? environment : new LocalEnvironment(this.logger);
  }

  /**
   * Execute a shell command and return its stdout as a string.
   * Logs stdout and stderr appropriately.
   * Throws an error if the command exits with a non-zero status.
   */
  async $(script: string): Promise<string> {
    this.logger.debug(`Executing script: ${script}`);
    const stdout = await this.environment!.$(script);
    this.logger.debug(`Script output: ${stdout}`);

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
