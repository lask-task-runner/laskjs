import { Effect } from "./Effect.ts";

export type JSONSchema =
  | { type: "null"; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "number"; description?: string }
  | { type: "string"; description?: string }
  | { type: "array"; elements: JSONSchema; description?: string }
  | { type: "object"; properties: { [key: string]: JSONSchema }; description?: string };

export type SchemaToJSONType<T extends JSONSchema> = T extends { type: "null" } ? null
  : T extends { type: "boolean" } ? boolean
  : T extends { type: "number" } ? number
  : T extends { type: "string" } ? string
  : T extends { type: "array"; elements: infer E }
    ? E extends JSONSchema ? SchemaToJSONType<E>[] : never
  : T extends { type: "object"; properties: infer P }
    ? P extends { [key: string]: JSONSchema } ? { [K in keyof P]: SchemaToJSONType<P[K]> }
    : never
  : never;

export type JSONType = SchemaToJSONType<JSONSchema>;

export interface Reader {
  read(): Promise<Uint8Array> | Uint8Array;
}

export interface Writer {
  write(raw: Uint8Array): Promise<void> | void;
}

export interface Decoder<T extends JSONType> {
  decode(data: Uint8Array): Promise<T> | T;
}

export interface Encoder<T extends JSONType> {
  encode(data: T): Promise<Uint8Array> | Uint8Array;
}

export type Source<T extends JSONType> = {
  reader: Reader;
  decoder: Decoder<T>;
};

export type Target<T extends JSONType> = {
  writer: Writer;
  encoder: Encoder<T>;
};

export type InputSchema<T extends JSONSchema = JSONSchema> = T extends
  { type: "object"; properties: infer P } ? P extends { [key: string]: JSONSchema } ?
      & T
      & { from?: Source<SchemaToJSONType<T>> }
      & {
        properties: {
          [K in keyof P]: InputSchema<P[K]>;
        };
      }
  : never
  : T & { from?: Source<SchemaToJSONType<T>> };

export type OutputSchema<T extends JSONSchema = JSONSchema> = T extends
  { type: "object"; properties: infer P }
  ? P extends { [key: string]: JSONSchema } ? T & { to?: Target<SchemaToJSONType<T>> } & {
      properties: {
        [K in keyof P]: OutputSchema<P[K]>;
      };
    }
  : never
  : T & { to?: Target<SchemaToJSONType<T>> };

export type Handler<I, O> = (input: I, effect: Effect) => Promise<O> | O;

export type Func<I, O> = (input: I) => Promise<O> | O;

export class Lask {
  private static readonly LASK_DIR = ".lask";
  private static readonly HISTORY_DIR = ".lask/history";

  private tasks: {
    [key: string]: {
      // deno-lint-ignore no-explicit-any
      func: Func<any, any>;
      inputSchema?: InputSchema<JSONSchema>;
      outputSchema?: OutputSchema<JSONSchema>;
    };
  } = {};

  task<I extends JSONSchema, O extends JSONSchema>(
    name: string,
    config: {
      input?: InputSchema<I>;
      output?: OutputSchema<O>;
      handler: Handler<SchemaToJSONType<I extends undefined ? void : I>, SchemaToJSONType<O>>;
    },
  ): Func<SchemaToJSONType<I>, SchemaToJSONType<O>> {
    const { input: inputSchema, output: outputSchema, handler } = config;

    const effect = new Effect(`Task#${name}`);
    // deno-lint-ignore no-explicit-any
    const func = (input: any): Promise<any> | any => handler(input, effect);
    this.tasks[name] = {
      func,
      inputSchema,
      outputSchema,
    };
    return func;
  }

  async readInput(inputSchema: InputSchema): Promise<JSONType> {
    if (inputSchema.from) {
      const rawData = await inputSchema.from.reader.read();
      const decodedData = await inputSchema.from.decoder.decode(rawData);
      return decodedData;
    }

    switch (inputSchema.type) {
      case "null":
        return null;
      case "boolean":
        return false;
      case "number":
        throw new Error("Cannot build number input without a source.");
      case "string":
        throw new Error("Cannot build string input without a source.");
      case "array":
        throw new Error("Cannot build array input without a source.");
      case "object": {
        const obj: { [key: string]: JSONType } = {};
        for (const key in inputSchema.properties) {
          obj[key] = await this.readInput(
            inputSchema.properties[key],
          );
        }
        return obj;
      }
    }
  }

  async writeOutput(outputSchema: OutputSchema, output: JSONType) {
    if (outputSchema.to) {
      const encodedData = await outputSchema.to.encoder.encode(output as never);
      await outputSchema.to.writer.write(encodedData);
    }

    switch (outputSchema.type) {
      case "array":
        for (const item of output as JSONType[]) {
          await this.writeOutput(outputSchema.elements, item);
        }
        break;
      case "object":
        for (const key in outputSchema.properties) {
          await this.writeOutput(
            outputSchema.properties[key],
            (output as { [key: string]: JSONType })[key],
          );
        }
        break;
      default:
        return;
    }
  }

  async bite() {
    const taskName = Deno.args[0];
    const task = this.tasks[taskName];

    if (!task) {
      console.error(`Task "${taskName}" not found.`);
      Deno.exit(1);
    }

    const { func, inputSchema, outputSchema } = task;

    const input: JSONType | undefined = inputSchema ? await this.readInput(inputSchema) : undefined;
    const output = await func(input);
    if (outputSchema) {
      await this.writeOutput(outputSchema, output);
    }
  }
}
