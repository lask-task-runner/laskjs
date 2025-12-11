import { parseArgs } from "@std/cli/parse-args";
import { Effect } from "./effect.ts";

export type JSONSchema =
  | JSONObjectSchema
  | JSONArraySchema
  | JSONStringSchema
  | JSONNumberSchema
  | JSONBooleanSchema
  | JSONNullSchema;

export type JSONObjectSchema = {
  type: "object";
  properties: { [key: string]: JSONSchema };
  description?: string;
};
export type JSONArraySchema = { type: "array"; elements: JSONSchema; description?: string };
export type JSONStringSchema = { type: "string"; description?: string };
export type JSONNumberSchema = { type: "number"; description?: string };
export type JSONBooleanSchema = { type: "boolean"; description?: string };
export type JSONNullSchema = { type: "null"; description?: string };

export type SchemaToJSONType<T extends JSONSchema> = T extends JSONNullSchema ? null
  : T extends JSONNullSchema ? null
  : T extends JSONBooleanSchema ? boolean
  : T extends JSONNumberSchema ? number
  : T extends JSONStringSchema ? string
  : T extends JSONArraySchema
    ? T extends { type: "array"; elements: infer E }
      ? E extends JSONSchema ? SchemaToJSONType<E>[] : never
    : never
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
    properties: { [key: string]: JSONSchema };
    description?: string;
  },
> = T extends { type: "object"; properties: infer P } ? P extends { [key: string]: JSONSchema } ?
      & T
      & {
        id: keyof P;
        from?: Source<SchemaToJSONType<T>>;
        properties: {
          [K in keyof P]: InputSchema<P[K]>;
        };
      }
  : never
  : never;

export type ResourceId = JSONStringSchema;

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

export type TaskOptions = {
  environment?: Environment;
};

export interface Environment {
  $(script: string): Promise<string>;
}

export class Lask {
  private readonly logger = new Effect("Lask");

  private tasks: {
    [key: string]: {
      func: TaskFunc<JSONType | undefined, JSONType | void>;
      inputSchema?: InputSchema<JSONSchema> | undefined;
      outputSchema?: OutputSchema<JSONSchema> | undefined;
    };
  } = {};

  private resources: {
    [key: string]: {
      schema: ResourceSchema;
      func: ResourceFunc<JSONType>;
    };
  } = {};

  use(plugin: Lask): void {
    Object.assign(this.tasks, plugin.tasks);
    Object.assign(this.resources, plugin.resources);
  }

  task<
    I extends JSONSchema | undefined = undefined,
    O extends JSONSchema | void = void,
  >(
    name: string,
    {
      input,
      output,
      options,
      handler,
    }: {
      input?: I extends JSONSchema ? InputSchema<I> : undefined;
      output?: O extends JSONSchema ? OutputSchema<O> : undefined;
      options?: TaskOptions;
      handler: TaskHandler<
        I extends JSONSchema ? SchemaToJSONType<I> : undefined,
        O extends JSONSchema ? SchemaToJSONType<O> : void
      >;
    },
  ): TaskFunc<
    I extends JSONSchema ? SchemaToJSONType<I> : undefined,
    O extends JSONSchema ? SchemaToJSONType<O> : void
  > {
    const effect = new Effect(`Task#${name}`, options?.environment);

    const func: TaskFunc<
      I extends JSONSchema ? SchemaToJSONType<I> : undefined,
      O extends JSONSchema ? SchemaToJSONType<O> : void
    > = (input) => handler(input, effect);
    this.tasks[name] = {
      // deno-lint-ignore no-explicit-any
      func: func as any,
      inputSchema: input,
      outputSchema: output,
    };
    return func;
  }

  resource<R extends ResourceSchema>(
    name: string,
    config: { resource: R } & ResourceHandler<SchemaToJSONType<R>>,
  ): ResourceFunc<SchemaToJSONType<R>> {
    const { resource: schema } = config;
    const func: ResourceFunc<SchemaToJSONType<R>> = {
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
    // deno-lint-ignore no-explicit-any
    this.resources[name] = { schema, func: func as any };
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
      this.logger.error(`Task "${taskName}" not found.`);
      Deno.exit(1);
    }

    const { func, inputSchema, outputSchema } = task;

    const input: JSONType | undefined = inputSchema ? await this.readInput(inputSchema) : undefined;
    const output = await func(input);
    if (outputSchema && output) {
      await this.writeOutput(outputSchema, output);
    }
  }

  private async createResource(resourceName: string): Promise<JSONType> {
    const resource = this.resources[resourceName];

    if (!resource) {
      this.logger.error(`Resource "${resourceName}" not found.`);
      Deno.exit(1);
    }

    const { schema, func } = resource;

    const input = await this.readInput(schema);
    const createdResource = await func.create(input as never);
    this.logger.info(`Resource created: ${JSON.stringify(createdResource)}`);

    return createdResource;
  }

  private async readResource(resourceName: string): Promise<JSONType> {
    const resource = this.resources[resourceName];

    if (!resource) {
      this.logger.error(`Resource "${resourceName}" not found.`);
      Deno.exit(1);
    }

    const { schema, func } = resource;

    const input = await this.readInput(schema.properties[schema.id]);
    const readResource = await func.read(input as never);
    this.logger.info(`Resource read: ${JSON.stringify(readResource)}`);

    return readResource;
  }

  private async updateResource(resourceName: string): Promise<JSONType> {
    const resource = this.resources[resourceName];

    if (!resource) {
      this.logger.error(`Resource "${resourceName}" not found.`);
      Deno.exit(1);
    }

    const { schema, func } = resource;

    const input = await this.readInput(schema);
    const previousResource = await this.readResource(resourceName);

    if (func.update) {
      const updatedResource = await func.update!(
        input as never,
        previousResource as never,
      );
      this.logger.info(`Resource updated: ${JSON.stringify(updatedResource)}`);
      return updatedResource;
    } else {
      // delete and recreate
      await func.delete(
        (input as { [key: string]: string })[schema.id] as never,
        input as never,
      );
      const createdResource = await func.create(input as never);
      this.logger.info(
        `Resource updated via delete and recreate: ${JSON.stringify(createdResource)}`,
      );
      return createdResource;
    }
  }

  private async deleteResource(resourceName: string): Promise<void> {
    const resource = this.resources[resourceName];

    if (!resource) {
      this.logger.error(`Resource "${resourceName}" not found.`);
      Deno.exit(1);
    }

    const { schema, func } = resource;

    const input = await this.readInput(schema.properties[schema.id]);
    const previousResource = await this.readResource(resourceName);
    await func.delete(
      (input as string) as never,
      previousResource as never,
    );
    this.logger.info(`Resource deleted: ${input as string}`);
  }

  async bite() {
    const parsedArgs = parseArgs(Deno.args, {
      string: ["_"],
      stopEarly: true,
    });

    const [commandName, subCommandName] = parsedArgs._;

    if (!commandName) {
      this.logger.error("No command specified.");
      Deno.exit(1);
    }

    switch (commandName) {
      case "run": {
        if (!subCommandName) {
          this.logger.error("Task name is required for 'run' command.");
          Deno.exit(1);
        }
        await this.runTask(subCommandName);
        break;
      }
      case "create": {
        if (!subCommandName) {
          this.logger.error("Resource name is required for 'create' command.");
          Deno.exit(1);
        }
        await this.createResource(subCommandName);
        break;
      }
      case "read": {
        if (!subCommandName) {
          this.logger.error("Resource name is required for 'read' command.");
          Deno.exit(1);
        }
        await this.readResource(subCommandName);
        break;
      }
      case "update": {
        if (!subCommandName) {
          this.logger.error("Resource name is required for 'update' command.");
          Deno.exit(1);
        }
        await this.updateResource(subCommandName);
        break;
      }
      case "delete": {
        if (!subCommandName) {
          this.logger.error("Resource name is required for 'delete' command.");
          Deno.exit(1);
        }
        await this.deleteResource(subCommandName);
        break;
      }
      default:
        this.logger.error(`Unknown command: ${commandName}`);
        Deno.exit(1);
    }
  }
}
