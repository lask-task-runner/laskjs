import { readAllSync } from "jsr:@std/io/read-all";
import { command, number, positional, run, string, subcommands } from "npm:cmd-ts";
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

export type PositionalParameterType = {
  type: "string" | "number";
  description?: string;
};

export type ParameterType<T extends { [key: string]: PositionalParameterType }> = {
  [K in keyof T]: T[K]["type"] extends "string" ? string : T[K]["type"] extends "number" ? number
  : never;
};

export type Task<
  P extends { [key: string]: PositionalParameterType },
  T extends JSONDocument,
  R extends JSONDocument,
> = {
  parameters?: P;
  input?: T;
  output?: R;
  handler: (params: ParameterType<P>, input: JSONType<T>, effect: Effect) => Promise<JSONType<R>>;
};

export type TaskFunc<
  P extends { [key: string]: PositionalParameterType },
  T extends JSONDocument,
  R extends JSONDocument,
> = (params: ParameterType<P>, input: JSONType<T>) => Promise<JSONType<R>>;

export class Lask {
  private tasks: {
    [name: string]: Task<{ [key: string]: PositionalParameterType }, JSONDocument, JSONDocument>;
  } = {};
  private funcs: {
    [name: string]: TaskFunc<
      { [key: string]: PositionalParameterType },
      JSONDocument,
      JSONDocument
    >;
  } = {};
  private logger: LaskLogger = new LaskLogger("Main");

  /**
   * Register a new task.
   * @param name The name of the task.
   * @param task The task object containing input/output schemas, and handler.
   */
  task<
    P extends { [key: string]: PositionalParameterType },
    T extends JSONDocument,
    R extends JSONDocument,
  >(
    name: string,
    task: Task<P, T, R>,
  ): (params: ParameterType<P>, input: JSONType<T>) => Promise<JSONType<R>> {
    const effect = new Effect(`Task#${name}`);
    const func = (params: ParameterType<P>, input: JSONType<T>): Promise<JSONType<R>> =>
      task.handler(params, input, effect);
    this.tasks[name] = task as any;
    this.funcs[name] = func as unknown as TaskFunc<
      { [key: string]: PositionalParameterType },
      JSONDocument,
      JSONDocument
    >;
    return func;
  }

  /**
   * Run the Lask CLI. Parse command-line arguments and execute tasks.
   */
  async bite() {
    const commands: { [key: string]: any } = {};
    for (const taskName of Object.keys(this.tasks)) {
      const task = this.tasks[taskName];
      const func = this.funcs[taskName];
      commands[taskName] = command({
        name: taskName,
        args: Object.entries(task.parameters ?? {}).reduce((acc, [paramName, paramType]) => {
          acc[paramName] = positional({
            type: paramType.type === "string"
              ? string
              : paramType.type === "number"
              ? number
              : string,
            displayName: paramName,
            description: paramType.description,
          });
          return acc;
        }, {} as { [key: string]: any }),
        handler: async (args) => {
          const input = Deno.stdin.isTerminal()
            ? undefined
            : new TextDecoder().decode(readAllSync(Deno.stdin));
          const parsedInput = input === undefined ? undefined : JSON.parse(input);
          const output = await func(args as any, parsedInput);
          if (output !== undefined) console.log(JSON.stringify(output));
        },
      });
    }

    console.log(commands.length);

    const lask = subcommands({
      name: "lask",
      cmds: commands,
    });

    await run(lask, Deno.args);
  }
}
