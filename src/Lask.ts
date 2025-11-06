import * as cmd from "npm:cmd-ts";
import { Effect } from "./Effect.ts";

export interface Decoder<T> {
  schema(): T;
  decode(raw: Uint8Array): SchemaToType<T>;
}

export interface Encoder<T> {
  schema(): T;
  encode(data: SchemaToType<T>): Uint8Array;
}

export interface Reader {
  read(): Promise<Uint8Array>;
}

export interface Writer {
  write(raw: Uint8Array): Promise<void>;
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

  private async init() {
    await Deno.mkdir(".lask");
    await Deno.mkdir(".lask/history");
  }

  private buildCommandArgs(task: {
    // deno-lint-ignore no-explicit-any
    inputs: { [key: string]: Input<any> };
  }): { [key: string]: ReturnType<typeof cmd.positional> | ReturnType<typeof cmd.option> } {
    return Object.keys(task.inputs).reduce((acc, key) => {
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
    }, {} as { [key: string]: any });
  }

  private async processCustomInputs(task: {
    // deno-lint-ignore no-explicit-any
    inputs: { [key: string]: Input<any> };
    // deno-lint-ignore no-explicit-any
  }): Promise<{ [key: string]: any }> {
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
    return inputs;
  }

  private async processOutputs(
    // deno-lint-ignore no-explicit-any
    outputs: { [key: string]: Output<any> },
    // deno-lint-ignore no-explicit-any
    outputData: { [key: string]: any },
  ): Promise<void> {
    for (const key of Object.keys(outputs)) {
      const { encoder, writer } = outputs[key];
      const data = outputData[key];
      const raw = encoder.encode(data);
      await writer.write(raw);
    }
  }

  private async saveTaskHistory(
    taskName: string,
    // deno-lint-ignore no-explicit-any
    inputs: { [key: string]: any },
    // deno-lint-ignore no-explicit-any
    outputs: { [key: string]: any },
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const timestampForFile = timestamp.replace(/:/g, "-").replace(/\..+/, "");

    // Encode inputs and outputs to base64
    const encoder = new TextEncoder();
    const inputsJson = JSON.stringify(inputs);
    const outputsJson = JSON.stringify(outputs);
    const inputsBase64 = btoa(String.fromCharCode(...encoder.encode(inputsJson)));
    const outputsBase64 = btoa(String.fromCharCode(...encoder.encode(outputsJson)));

    const historyRecord = {
      timestamp,
      taskName,
      inputs: inputsBase64,
      outputs: outputsBase64,
    };

    const historyDir = ".lask/history";
    try {
      await Deno.mkdir(historyDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }

    const filename = `${historyDir}/${timestampForFile}_${taskName}.json`;
    await Deno.writeTextFile(filename, JSON.stringify(historyRecord, null, 2));
  }

  private createTaskCommand(taskName: string): ReturnType<typeof cmd.command> {
    const task = this.tasks[taskName];

    return cmd.command({
      name: taskName,
      args: this.buildCommandArgs(task),
      handler: async (args) => {
        const customInputs = await this.processCustomInputs(task);
        const allInputs = { ...args, ...customInputs };

        console.log(`Inputs for task ${taskName}:`, allInputs);

        const output = await task.func(allInputs);
        await this.processOutputs(task.outputs, output);

        // Save task execution history
        await this.saveTaskHistory(taskName, allInputs, output);
      },
    });
  }

  private createInitCommand(): ReturnType<typeof cmd.command> {
    return cmd.command({
      name: ":init",
      args: {},
      handler: async () => {
        await this.init();
        console.log("Initialized .lask directory.");
      },
    });
  }

  private async listHistory(): Promise<void> {
    const historyDir = ".lask/history";

    try {
      const entries = [];
      for await (const entry of Deno.readDir(historyDir)) {
        if (entry.isFile && entry.name.endsWith(".json")) {
          entries.push(entry.name);
        }
      }

      // Sort by filename (which includes timestamp)
      entries.sort();

      // Read and output each history file as JSONL
      for (const filename of entries) {
        const filePath = `${historyDir}/${filename}`;
        const content = await Deno.readTextFile(filePath);
        const record = JSON.parse(content);
        // Output as single line JSON (JSONL format)
        console.log(JSON.stringify(record));
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.error("No history found. Run ':init' first or execute some tasks.");
      } else {
        throw error;
      }
    }
  }

  private createHistoryCommand(): ReturnType<typeof cmd.command> {
    return cmd.command({
      name: ":history",
      args: {},
      handler: async () => {
        await this.listHistory();
      },
    });
  }

  private buildCommands(): Record<string, ReturnType<typeof cmd.command>> {
    const commands: Record<string, ReturnType<typeof cmd.command>> = {};

    for (const taskName of Object.keys(this.tasks)) {
      commands[taskName] = this.createTaskCommand(taskName);
    }

    commands[":init"] = this.createInitCommand();
    commands[":history"] = this.createHistoryCommand();

    return commands;
  }

  async bite() {
    const commands = this.buildCommands();
    const lask = cmd.subcommands({
      name: "lask",
      cmds: commands,
    });

    await cmd.run(lask, Deno.args);
  }
}
