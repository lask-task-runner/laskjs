import { readAllSync } from "jsr:@std/io/read-all";
import { Effect } from "./Effect.ts";
import { LaskLogger } from "./LaskLogger.ts";

export type JSON = void | null | boolean | number | string | JSON[] | { [key: string]: JSON };

export type Task<T extends JSON, R extends JSON> = (input: T, effect: Effect) => Promise<R>;

export class Lask {
  private tasks: { [name: string]: (input: JSON) => Promise<JSON> } = {};
  private logger: LaskLogger = new LaskLogger("Main");

  /**
   * Register a new task.
   * @param name The name of the task.
   * @param task The task function.
   */
  task<T extends JSON, R extends JSON>(
    name: string,
    task: (input: T, effect: Effect) => Promise<R>,
  ): (input: T) => Promise<R> {
    const f = (input: T) => task(input, effect);
    this.tasks[name] = f as unknown as (input: JSON) => Promise<JSON>;
    const effect = new Effect(`Task#${name}`);
    return f;
  }

  /**
   * Run the Lask CLI. Parse command-line arguments and execute tasks.
   */
  async bite() {
    const taskName = Deno.args[0];
    const input = Deno.stdin.isTerminal()
      ? undefined
      : new TextDecoder().decode(readAllSync(Deno.stdin));

    const task = this.tasks[taskName];

    if (task) {
      const parsedInput = input === undefined ? undefined : JSON.parse(input);
      const output = await task(parsedInput);
      if (output !== undefined) console.log(JSON.stringify(output));
    } else {
      this.logger.error(`Task not found: ${taskName}`);
    }
  }
}
