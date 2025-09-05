import { readAllSync } from "jsr:@std/io/read-all";
import winston from "npm:winston";

export type JSON = null | boolean | number | string | JSON[] | { [key: string]: JSON };

export type Task<T extends JSON> = (input: T, effect: Effect) => JSON;

class LaskLogger {
  private logger: winston.Logger;

  constructor(name: string) {
    this.logger = winston.createLogger({
      level: "debug",
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp }) => {
          return `${timestamp} [${level}] (${name}): ${message}`;
        }),
      ),
      transports: [
        new winston.transports.Console({
          stderrLevels: ["error", "warn", "info", "debug"],
        }),
      ],
    });
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

class Effect {
  public logger: LaskLogger;

  constructor(name: string) {
    this.logger = new LaskLogger(name);
  }

  /**
   * Log info message
   */
  // deno-lint-ignore no-explicit-any
  log(message: any): void {
    this.logger.info(message);
  }
}

class Lask {
  private tasks: { [name: string]: Task<JSON> } = {};
  private logger: LaskLogger = new LaskLogger("Main");

  /**
   * Register a new task.
   * @param name The name of the task.
   * @param task The task function.
   */
  task<T extends JSON>(name: string, task: Task<T>): void {
    this.tasks[name] = task as Task<JSON>;
  }

  /**
   * Run the Lask CLI. Parse command-line arguments and execute tasks.
   */
  bite() {
    const taskName = Deno.args[0];
    const input = Deno.stdin.isTerminal()
      ? "null"
      : new TextDecoder().decode(readAllSync(Deno.stdin));

    const task = this.tasks[taskName];

    if (task) {
      const effect = new Effect(`Task#${taskName}`);
      const parsedInput = JSON.parse(input);
      const output = task(parsedInput, effect);
      console.log(JSON.stringify(output));
    } else {
      this.logger.error(`Task not found: ${taskName}`);
    }
  }
}

export { Lask };
