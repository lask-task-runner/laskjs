import * as cmd from "npm:cmd-ts@0.14.3";
import { Effect } from "./Effect.ts";

export type JSONSchema =
  | { type: "null"; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "number"; description?: string }
  | { type: "string"; description?: string }
  | { type: "array"; elements: JSONSchema; description?: string }
  | { type: "object"; properties: { [key: string]: JSONSchema }; description?: string };

export type JSONType<T extends JSONSchema> = T extends { type: "null" } ? null
  : T extends { type: "boolean" } ? boolean
  : T extends { type: "number" } ? number
  : T extends { type: "string" } ? string
  : T extends { type: "array"; elements: infer E } ? E extends JSONSchema ? JSONType<E>[] : never
  : T extends { type: "object"; properties: infer P }
    ? P extends { [key: string]: JSONSchema } ? { [K in keyof P]: JSONType<P[K]> }
    : never
  : never;

export interface Decoder<T extends JSONSchema> {
  schema(): T;
  decode(raw: Uint8Array): JSONType<T>;
}

export interface Encoder<T extends JSONSchema> {
  schema(): T;
  encode(data: JSONType<T>): Uint8Array;
}

export interface Reader {
  read(): Promise<Uint8Array>;
}

export interface Writer {
  write(raw: Uint8Array): Promise<void>;
}

export type InputSource<T extends JSONSchema> = {
  kind: "param";
  schema: T;
  description?: string;
} | {
  kind: "option";
  schema: T;
  long: string;
  short?: string;
  description?: string;
} | {
  kind: "custom";
  decoder: Decoder<T>;
  reader: Reader;
};

export type InputSchema = JSONSchema & {
  from?: InputSource<JSONSchema>;
};

export type OutputSchema = JSONSchema & {
  to?: Writer;
};

export function param<T extends JSONSchema>(
  schema: T,
  options?: { description?: string },
): InputSource<T> {
  return { kind: "param", schema, description: options?.description };
}

export function option<T extends JSONSchema>(
  schema: T,
  options: { long: string; short?: string; description?: string },
): InputSource<T> {
  return {
    kind: "option",
    schema,
    long: options.long,
    short: options.short,
    description: options.description,
  };
}

export function input<T extends JSONSchema>(reader: Reader, decoder: Decoder<T>): InputSource<T> {
  return { kind: "custom", decoder, reader };
}

export type Handler<I, O> = (input: I, effect: Effect) => Promise<O>;

export type Func<I, O> = (input: I) => Promise<O>;

export class Lask {
  private static readonly LASK_DIR = ".lask";
  private static readonly HISTORY_DIR = ".lask/history";

  private tasks: {
    [key: string]: {
      // deno-lint-ignore no-explicit-any
      func: Func<any, any>;
      inputSchema?: InputSchema;
      outputSchema?: OutputSchema;
    };
  } = {};

  task<I extends InputSchema, O extends OutputSchema>(
    name: string,
    config: {
      input?: I;
      output?: O;
      handler: Handler<JSONType<I extends undefined ? void : I>, JSONType<O>>;
    },
  ): Func<JSONType<I>, JSONType<O>> {
    const { input: inputSchema, output: outputSchema, handler } = config;

    const effect = new Effect(`Task#${name}`);
    // deno-lint-ignore no-explicit-any
    const func = (input: any): Promise<any> => handler(input, effect);
    this.tasks[name] = {
      func,
      inputSchema,
      outputSchema,
    };
    return func;
  }

  private async init() {
    await Deno.mkdir(Lask.LASK_DIR);
    await Deno.mkdir(Lask.HISTORY_DIR);
  }

  // deno-lint-ignore no-explicit-any
  private buildCommandArgs(inputSchema?: InputSchema): { [key: string]: any } {
    if (!inputSchema || inputSchema.type !== "object") {
      return {};
    }

    // deno-lint-ignore no-explicit-any
    const args: { [key: string]: any } = {};

    for (const [key, propSchema] of Object.entries(inputSchema.properties)) {
      const from = (propSchema as InputSchema).from;
      if (!from) continue;

      if (from.kind === "param") {
        const cmdType = this.schemaToCmdType(from.schema);
        args[key] = cmd.positional({
          type: cmdType,
          description: from.description,
        });
      } else if (from.kind === "option") {
        const cmdType = this.schemaToCmdType(from.schema);
        args[key] = cmd.option({
          type: cmdType,
          long: from.long,
          short: from.short,
          description: from.description,
        });
      }
    }

    return args;
  }

  private schemaToCmdType(schema: JSONSchema): typeof cmd.string | typeof cmd.number {
    if (schema.type === "string") {
      return cmd.string;
    } else if (schema.type === "number") {
      return cmd.number;
    }
    // Default to string for complex types
    return cmd.string;
  }

  // deno-lint-ignore no-explicit-any
  private async processCustomInputs(inputSchema?: InputSchema): Promise<{ [key: string]: any }> {
    // deno-lint-ignore no-explicit-any
    const inputs: { [key: string]: any } = {};

    if (!inputSchema || inputSchema.type !== "object") {
      return inputs;
    }

    for (const [key, propSchema] of Object.entries(inputSchema.properties)) {
      const from = (propSchema as InputSchema).from;
      if (!from || from.kind !== "custom") {
        continue;
      }
      const { decoder, reader } = from;
      const raw = await reader.read();
      inputs[key] = await decoder.decode(raw);
    }
    return inputs;
  }

  private async processOutputs(
    outputSchema: OutputSchema | undefined,
    // deno-lint-ignore no-explicit-any
    outputData: any,
    encoder: Encoder<JSONSchema>,
  ): Promise<void> {
    if (!outputSchema || !outputSchema.to) {
      return;
    }

    const raw = encoder.encode(outputData);
    await outputSchema.to.write(raw);
  }

  private async saveTaskHistory(
    taskName: string,
    // deno-lint-ignore no-explicit-any
    input: { [key: string]: any },
    // deno-lint-ignore no-explicit-any
    output: { [key: string]: any },
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const timestampForFile = timestamp.replace(/:/g, "-").replace(/\..+/, "");

    const historyRecord = {
      timestamp,
      taskName,
      input,
      output,
    };

    try {
      await Deno.mkdir(Lask.HISTORY_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }

    const filename = `${Lask.HISTORY_DIR}/${timestampForFile}_${taskName}.json`;
    await Deno.writeTextFile(filename, JSON.stringify(historyRecord, null, 2));
  }

  private createTaskCommand(taskName: string): ReturnType<typeof cmd.command> {
    const task = this.tasks[taskName];

    return cmd.command({
      name: taskName,
      args: this.buildCommandArgs(task.inputSchema),
      handler: async (args) => {
        const customInputs = await this.processCustomInputs(task.inputSchema);
        const allInputs = { ...args, ...customInputs };

        console.log(`Inputs for task ${taskName}:`, allInputs);

        const output = await task.func(allInputs);

        // Process output if outputSchema has 'to' writer
        if (task.outputSchema && task.outputSchema.to) {
          // Create encoder from outputSchema
          const { json } = await import("./Codec/JSON.ts");
          const encoder = json(task.outputSchema);
          await this.processOutputs(task.outputSchema, output, encoder);
        }

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

  private async listHistory(taskFilter?: string): Promise<void> {
    try {
      const entries = [];
      for await (const entry of Deno.readDir(Lask.HISTORY_DIR)) {
        if (entry.isFile && entry.name.endsWith(".json")) {
          entries.push(entry.name);
        }
      }

      // Sort by filename (which includes timestamp)
      entries.sort();

      // Read and output each history file as JSONL
      for (const filename of entries) {
        const filePath = `${Lask.HISTORY_DIR}/${filename}`;
        const content = await Deno.readTextFile(filePath);
        const record = JSON.parse(content);

        // Filter by task name if specified
        if (taskFilter && record.taskName !== taskFilter) {
          continue;
        }

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
      args: {
        task: cmd.option({
          type: cmd.optional(cmd.string),
          long: "task",
          description: "Filter history by task name",
        }),
      },
      handler: async (args) => {
        await this.listHistory(args.task);
      },
    }) as ReturnType<typeof cmd.command>;
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
