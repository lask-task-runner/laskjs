import { Local } from "./environment/local.ts";
import { PromptResult, SingletonPrompt, StatefulPrompt, StatelessPrompt } from "./lask.ts";
import { Logger } from "./logger.ts";

type PromptProvider = StatefulPrompt | StatelessPrompt | SingletonPrompt;

function isStatefulPrompt(prompt: PromptProvider): prompt is StatefulPrompt {
  return "newPrompt" in prompt && "cleanupAllPrompts" in prompt;
}

function isStatelessPrompt(prompt: PromptProvider): prompt is StatelessPrompt {
  return "onetimePrompt" in prompt;
}

function isSingletonPrompt(prompt: PromptProvider): prompt is SingletonPrompt {
  return "getPrompt" in prompt;
}

export class Effect {
  public logger: Logger;
  private promptProvider: PromptProvider;
  private cachedPromptFunc: ((script: string) => Promise<PromptResult>) | null = null;

  constructor(name: string, promptProvider?: PromptProvider) {
    this.logger = new Logger(name);
    this.promptProvider = promptProvider ?? new Local();
  }

  /**
   * Get or create a prompt function for StatefulPrompt.
   * Creates a new prompt and returns a function to execute scripts on it.
   * The created prompt is cached for reuse.
   */
  async newPrompt(): Promise<(script: string) => Promise<PromptResult>> {
    if (!isStatefulPrompt(this.promptProvider)) {
      throw new Error("newPrompt() is only available for StatefulPrompt");
    }
    if (!this.cachedPromptFunc) {
      this.cachedPromptFunc = await this.promptProvider.newPrompt();
    }
    return this.cachedPromptFunc;
  }

  /**
   * Execute a shell command and return its stdout as a string.
   * Logs stdout and stderr appropriately.
   * Throws an error if the command exits with a non-zero status.
   * Note: StatefulPrompt is not supported with $. Use newPrompt() instead.
   */
  async $(script: string): Promise<PromptResult> {
    this.logger.debug(`Executing script: ${script}`);

    try {
      let result: PromptResult;

      if (isStatelessPrompt(this.promptProvider)) {
        // StatelessPrompt: use onetimePrompt for each execution
        result = await this.promptProvider.onetimePrompt(script);
      } else if (isSingletonPrompt(this.promptProvider)) {
        // SingletonPrompt: get the singleton prompt function and use it
        if (!this.cachedPromptFunc) {
          this.cachedPromptFunc = await this.promptProvider.getPrompt();
        }
        result = await this.cachedPromptFunc(script);
      } else {
        throw new Error("StatefulPrompt is not supported with $(). Use newPrompt() instead.");
      }

      this.logger.debug(`Script output: ${result.stdout}`);
      return result;
    } catch (error) {
      this.logger.error(`Script error: ${error}`);
      throw error;
    }
  }

  /**
   * Cleanup resources (for StatefulPrompt)
   */
  async cleanup(): Promise<void> {
    if (isStatefulPrompt(this.promptProvider)) {
      await this.promptProvider.cleanupAllPrompts();
    }
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
