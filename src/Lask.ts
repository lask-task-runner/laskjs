import { readAllSync } from "jsr:@std/io/read-all";
import { Effect } from "./Effect.ts";
import { LaskLogger } from "./LaskLogger.ts";

export type JSONDocument =
  | { type: "void"; description?: string }
  | { type: "null"; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "number"; description?: string }
  | { type: "string"; description?: string }
  | { type: "array"; elements: JSONDocument; description?: string }
  | { type: "object"; properties: { [key: string]: JSONDocument }; description?: string };

export type JSONType<T extends JSONDocument> = T extends { type: "void" } ? void
  : T extends { type: "null" } ? null
  : T extends { type: "boolean" } ? boolean
  : T extends { type: "number" } ? number
  : T extends { type: "string" } ? string
  : T extends { type: "array"; elements: infer E } ? E extends JSONDocument ? JSONType<E>[] : never
  : T extends { type: "object"; properties: infer P }
    ? P extends { [key: string]: JSONDocument } ? { [K in keyof P]: JSONType<P[K]> }
    : never
  : never;

export class Lask {
  private tasks: { [name: string]: (input: JSON) => Promise<JSON> } = {};
  private logger: LaskLogger = new LaskLogger("Main");

  /**
   * Register a new task.
   * @param name The name of the task.
   * @param args The JSON schema for the task's input.
   * @param returns The JSON schema for the task's output.
   * @param task The task function.
   */
  task<T extends JSONDocument, R extends JSONDocument>(
    name: string,
    _args: T = { type: "void" } as T,
    _returns: R = { type: "void" } as R,
    task: (input: JSONType<T>, effect: Effect) => Promise<JSONType<R>>,
  ): (input: JSONType<T>) => Promise<JSONType<R>> {
    const f = (input: JSONType<T>) => task(input, effect);
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
