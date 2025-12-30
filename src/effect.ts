import { LocalEnvironment } from "./environment/local.ts";
import { Environment, PromptResult } from "./lask.ts";
import { Logger } from "./logger.ts";

export class Effect {
  public logger: Logger;
  private environment: Environment;

  constructor(name: string, environment?: Environment) {
    this.logger = new Logger(name);
    this.environment = environment ? environment : new LocalEnvironment(this.logger);
  }

  /**
   * Execute a shell command and return its stdout as a string.
   * Logs stdout and stderr appropriately.
   * Throws an error if the command exits with a non-zero status.
   */
  async $(script: string): Promise<PromptResult> {
    this.logger.debug(`Executing script: ${script}`);
    const prompt = await this.environment.openPrompt();
    const result = await prompt.$(script);
    this.logger.debug(`Script output: ${result.stdout}`);
    await this.environment.closePrompt(prompt);

    return result;
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
