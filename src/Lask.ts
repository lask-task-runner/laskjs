import { readAllSync } from "jsr:@std/io/read-all";

export type JSON = null | boolean | number | string | JSON[] | { [key: string]: JSON };

export type Task<T extends JSON> = (input: T) => JSON;

class Lask {
  private tasks: { [name: string]: Task<JSON> } = {};

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
      const result = task(JSON.parse(input));
      console.log(JSON.stringify(result));
    } else {
      console.error(`Task not found: ${taskName}`);
    }
  }
}

export { Lask };
