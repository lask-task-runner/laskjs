import { parseArgs } from "@std/cli/parse-args";
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

export type ResourceSchema<
  T extends JSONSchema = {
    type: "object";
    properties: { id: ResourceId; [key: string]: JSONSchema };
    description?: string;
  },
> = T extends { type: "object"; properties: infer P } ? P extends { [key: string]: JSONSchema } ?
      & T
      & { from?: Source<SchemaToJSONType<T>> }
      & {
        properties: {
          [K in keyof P]: InputSchema<P[K]>;
        };
      }
  : never
  : T & { from?: Source<SchemaToJSONType<T>> };

export type ResourceId = { type: "string"; description?: string };

export type TaskHandler<I, O> = (input: I, effect: Effect) => Promise<O> | O;

export type ResourceHandler<R> = {
  create: (resource: R, effect: Effect) => Promise<R> | R;
  read: (id: SchemaToJSONType<ResourceId>, effect: Effect) => Promise<R> | R;
  update?: (resource: R, previous: R, effect: Effect) => Promise<R> | R;
  delete: (id: SchemaToJSONType<ResourceId>, resource: R, effect: Effect) => Promise<void> | void;
};

export type TaskFunc<I, O> = (input: I) => Promise<O> | O;

export type ResourceFunc<R> = {
  create: (resource: R) => Promise<R> | R;
  read: (id: SchemaToJSONType<ResourceId>) => Promise<R> | R;
  update?: (resource: R, previous: R) => Promise<R> | R;
  delete: (id: SchemaToJSONType<ResourceId>, resource: R) => Promise<void> | void;
};

export class Lask {
  private static readonly LASK_DIR = ".lask";

  private tasks: {
    [key: string]: {
      // deno-lint-ignore no-explicit-any
      func: TaskFunc<any, any>;
      inputSchema?: InputSchema<JSONSchema>;
      outputSchema?: OutputSchema<JSONSchema>;
    };
  } = {};

  private resources: {
    [key: string]: {
      schema: ResourceSchema;
      // deno-lint-ignore no-explicit-any
      func: ResourceFunc<any>;
    };
  } = {};

  task<I extends JSONSchema, O extends JSONSchema>(
    name: string,
    config: {
      input?: InputSchema<I>;
      output?: OutputSchema<O>;
      handler: TaskHandler<SchemaToJSONType<I extends undefined ? void : I>, SchemaToJSONType<O>>;
    },
  ): TaskFunc<SchemaToJSONType<I>, SchemaToJSONType<O>> {
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

  resource<R extends ResourceSchema>(
    name: string,
    config: { resource: R } & ResourceHandler<SchemaToJSONType<R>>,
  ): ResourceFunc<SchemaToJSONType<R>> {
    const { resource: schema } = config;
    const func = {
      create: (resource: SchemaToJSONType<R>) =>
        config.create(resource, new Effect(`Resource#${name}#create`)),
      read: (id: SchemaToJSONType<ResourceId>) =>
        config.read(id, new Effect(`Resource#${name}#read`)),
      update: config.update
        ? (resource: SchemaToJSONType<R>, previous: SchemaToJSONType<R>) =>
          config.update!(resource, previous, new Effect(`Resource#${name}#update`))
        : undefined,
      delete: (id: SchemaToJSONType<ResourceId>, resource: SchemaToJSONType<R>) =>
        config.delete(id, resource, new Effect(`Resource#${name}#delete`)),
    };
    this.resources[name] = { schema, func };
    return func;
  }

  args(i: number): Reader {
    return {
      read(): Promise<Uint8Array> {
        const parsedArgs = parseArgs(Deno.args, {
          string: ["_"],
          stopEarly: true,
        });
        const positionalArgs = parsedArgs._.slice(2); // Skip command and subcommand
        const arg = positionalArgs[i];
        return arg !== undefined
          ? Promise.resolve(new TextEncoder().encode(String(arg)))
          : Promise.reject(new Error(`Argument at index ${i} is not provided.`));
      },
    };
  }

  flags(name: string): Reader {
    return {
      read(): Promise<Uint8Array> {
        const parsedArgs = parseArgs(Deno.args, {
          string: [name],
        });
        const flagValue = parsedArgs[name];
        return flagValue !== undefined
          ? Promise.resolve(new TextEncoder().encode(String(flagValue)))
          : Promise.reject(new Error(`Flag "${name}" is not provided.`));
      },
    };
  }

  private async readInput(inputSchema: InputSchema): Promise<JSONType> {
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

  private async writeOutput(outputSchema: OutputSchema, output: JSONType) {
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

  private async runTask(taskName: string) {
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

  private async createResource(resourceName: string) {
    const resource = this.resources[resourceName];

    if (!resource) {
      console.error(`Resource "${resourceName}" not found.`);
      Deno.exit(1);
    }

    const { schema, func } = resource;

    const input = await this.readInput(schema);
    const createdResource = await func.create(input as never);
    console.log("Resource created:", createdResource);
  }

  private async readResource(resourceName: string) {
    const resource = this.resources[resourceName];

    if (!resource) {
      console.error(`Resource "${resourceName}" not found.`);
      Deno.exit(1);
    }

    const { schema, func } = resource;

    const input = await this.readInput(schema.properties.id);
    const readResource = await func.read(input as never);
    console.log("Resource read:", readResource);
  }

  private async updateResource(resourceName: string) {
    const resource = this.resources[resourceName];

    if (!resource) {
      console.error(`Resource "${resourceName}" not found.`);
      Deno.exit(1);
    }

    const { schema, func } = resource;

    if (func.update) {
      const input = await this.readInput(schema);
      const previousInput = await this.readInput(schema);
      const updatedResource = await func.update!(
        input as never,
        previousInput as never,
      );
      console.log("Resource updated:", updatedResource);
    } else {
      // delete and recreate
      const input = await this.readInput(schema);
      await func.delete(
        (input as { id: string }).id as never,
        input as never,
      );
      const createdResource = await func.create(input as never);
      console.log("Resource updated via delete and recreate:", createdResource);
    }
  }

  private async deleteResource(resourceName: string) {
    const resource = this.resources[resourceName];

    if (!resource) {
      console.error(`Resource "${resourceName}" not found.`);
      Deno.exit(1);
    }

    const { schema, func } = resource;

    const input = await this.readInput(schema);
    await func.delete(
      (input as { id: string }).id as never,
      input as never,
    );
    console.log("Resource deleted:", (input as { id: string }).id);
  }

  async bite() {
    const parsedArgs = parseArgs(Deno.args, {
      string: ["_"],
      stopEarly: true,
    });

    const [commandName, subCommandName] = parsedArgs._;

    if (!commandName) {
      console.error("No command specified.");
      Deno.exit(1);
    }

    switch (commandName) {
      case "run": {
        if (!subCommandName) {
          console.error("Task name is required for 'run' command.");
          Deno.exit(1);
        }
        await this.runTask(subCommandName);
        break;
      }
      case "create": {
        if (!subCommandName) {
          console.error("Resource name is required for 'create' command.");
          Deno.exit(1);
        }
        await this.createResource(subCommandName);
        break;
      }
      case "read": {
        if (!subCommandName) {
          console.error("Resource name is required for 'read' command.");
          Deno.exit(1);
        }
        await this.readResource(subCommandName);
        break;
      }
      case "update": {
        if (!subCommandName) {
          console.error("Resource name is required for 'update' command.");
          Deno.exit(1);
        }
        await this.updateResource(subCommandName);
        break;
      }
      case "delete": {
        if (!subCommandName) {
          console.error("Resource name is required for 'delete' command.");
          Deno.exit(1);
        }
        await this.deleteResource(subCommandName);
        break;
      }
      default:
        console.error(`Unknown command: ${commandName}`);
        Deno.exit(1);
    }
  }
}
