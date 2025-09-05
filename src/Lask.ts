import { readAllSync } from "jsr:@std/io/read-all";
import { Effect } from "./Effect.ts";
import { LaskLogger } from "./LaskLogger.ts";

export type JSON = null | boolean | number | string | JSON[] | { [key: string]: JSON };

export type Task<T extends JSON> = (input: T, effect: Effect) => Promise<JSON>;

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
  async bite() {
    const taskName = Deno.args[0];
    const input = Deno.stdin.isTerminal()
      ? "null"
      : new TextDecoder().decode(readAllSync(Deno.stdin));

    const task = this.tasks[taskName];

    if (task) {
      const effect = new Effect(`Task#${taskName}`);
      const parsedInput = JSON.parse(input);
      const output = await task(parsedInput, effect);
      console.log(JSON.stringify(output));
    } else {
      this.logger.error(`Task not found: ${taskName}`);
    }
  }
}

export { Lask };
