import * as cmd from "npm:cmd-ts";
import { Effect } from "./Effect.ts";

export interface Decoder<T> {
  schema(): T;
  decode(raw: string): SchemaToType<T>;
}

export interface Encoder<T> {
  schema(): T;
  encode(data: SchemaToType<T>): string;
}

export interface Reader {
  read(): Promise<string>;
}

export interface Writer {
  write(raw: string): Promise<void>;
}

export type Input<T> = {
  kind: "param";
  type: "string" | "number";
  description?: string;
} | {
  kind: "option";
  type: "string" | "number";
  long: string;
  short?: string;
  description?: string;
} | {
  kind: "custom";
  decoder: Decoder<T>;
  reader: Reader;
};

export interface Output<T> {
  encoder: Encoder<T>;
  writer: Writer;
}

export function param<T extends ParamSchema>(
  param: { type: T; description?: string },
): Input<T> {
  return { kind: "param", ...param };
}

export function option<T extends OptionSchema>(
  option: { type: T; long: string; short?: string; description?: string },
): Input<T> {
  return { kind: "option", ...option };
}

export type ParamSchema = "string" | "number";

export type OptionSchema = "string" | "number";

export type ParamType<T extends ParamSchema> = T extends "string" ? string
  : T extends "number" ? number
  : never;

export type OptionType<T extends OptionSchema> = T extends "string" ? string
  : T extends "number" ? number
  : never;

export function input<T>(reader: Reader, decoder: Decoder<T>): Input<T> {
  return { kind: "custom", decoder, reader };
}

export function output<T>(writer: Writer, encoder: Encoder<T>): Output<T> {
  return { encoder, writer };
}

export type Handler<I, O> = (input: I, effect: Effect) => Promise<O>;

export type Func<I, O> = (input: I) => Promise<O>;

export interface SchemaToType<T> {
  ParamSchema: T extends ParamSchema ? ParamType<T> : never;
  OptionSchema: T extends OptionSchema ? OptionType<T> : never;
}

export class Lask {
  private tasks: {
    [key: string]: {
      // deno-lint-ignore no-explicit-any
      func: Func<any, any>;
      // deno-lint-ignore no-explicit-any
      inputs: { [key: string]: Input<any> };
      // deno-lint-ignore no-explicit-any
      outputs: { [key: string]: Output<any> };
    };
  } = {};

  task<
    IS,
    IT extends keyof SchemaToType<IS>,
    OS,
    OT extends keyof SchemaToType<OS>,
  >(
    name: string,
    inputs: { [key in keyof IS]: Input<IS[key]> },
    outputs: { [key in keyof OS]: Output<OS[key]> },
    handler: Handler<
      { [key in keyof typeof inputs]: SchemaToType<IS[key]>[IT] },
      {
        [key in keyof typeof outputs]: SchemaToType<OS[key]>[OT] extends never ? void
          : SchemaToType<OS[key]>[OT];
      }
    >,
  ): Func<
    { [key in keyof typeof inputs]: SchemaToType<IS[key]>[IT] },
    {
      [key in keyof typeof outputs]: SchemaToType<OS[key]>[OT] extends never ? void
        : SchemaToType<OS[key]>[OT];
    }
  > {
    const effect = new Effect(`Task#${name}`);
    const func = (input: { [key in keyof typeof inputs]: SchemaToType<IS[key]>[IT] }): Promise<
      {
        [key in keyof typeof outputs]: SchemaToType<OS[key]>[OT] extends never ? void
          : SchemaToType<OS[key]>[OT];
      }
    > => handler(input, effect);
    this.tasks[name] = {
      func,
      inputs,
      outputs,
    };
    return func;
  }

  async bite() {
    const commands: Record<string, ReturnType<typeof cmd.command>> = {};
    for (const taskName of Object.keys(this.tasks)) {
      const task = this.tasks[taskName];
      commands[taskName] = cmd.command({
        name: taskName,
        args: Object.keys(task.inputs).reduce((acc, key) => {
          const input = task.inputs[key];

          if (input.kind === "param") {
            acc[key] = cmd.positional({
              type: input.type === "string" ? cmd.string : cmd.number,
              description: input.description,
            });
          }

          if (input.kind === "option") {
            acc[key] = cmd.option({
              type: input.type === "string" ? cmd.string : cmd.number,
              long: input.long,
              short: input.short,
              description: input.description,
            });
          }

          return acc;
          // deno-lint-ignore no-explicit-any
        }, {} as { [key: string]: any }),
        handler: async (args) => {
          // deno-lint-ignore no-explicit-any
          const inputs: { [key: string]: any } = {};
          for (const key of Object.keys(task.inputs)) {
            const input = task.inputs[key];
            if (input.kind !== "custom") {
              continue;
            }
            const { decoder, reader } = input;
            const raw = await reader.read();
            inputs[key] = await decoder.decode(raw);
          }

          console.log(`Inputs for task ${taskName}:`, { ...args, ...inputs });
          const output = await task.func({ ...args, ...inputs });
          Object.keys(task.outputs).forEach(async (key) => {
            const { encoder, writer } = task.outputs[key];
            const data = output[key];
            const raw = encoder.encode(data);
            await writer.write(raw);
          });
        },
      });
    }

    const lask = cmd.subcommands({
      name: "lask",
      cmds: commands,
    });

    await cmd.run(lask, Deno.args);
  }
}
