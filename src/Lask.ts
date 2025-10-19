import { readAllSync } from "jsr:@std/io/read-all";
import { command, number, positional, run, string, subcommands } from "npm:cmd-ts";
import { Effect } from "./Effect.ts";
import { LaskLogger } from "./LaskLogger.ts";

/**
 * Parameter schema definition for task parameters.
 */
export type ParamSchema = {
  [key: string]: {
    type: "string" | "number";
    description?: string;
    required?: boolean;
  };
};

/**
 * Type mapping for parameter schema to actual TypeScript types.
 *
 * @template P Parameter schema type
 */
export type ParamType<P extends ParamSchema> = {
  [K in keyof P]: P[K] extends { type: "string" } ? string
    : P[K] extends { type: "number" } ? number
    : P[K] extends { type: "boolean" } ? boolean
    : never;
};

/**
 * Decoder interface for converting string data to typed objects.
 * Provides a contract for parsing input data from various sources (stdin, files, etc.).
 *
 * @template T The target type after decoding
 */
export interface Decoder<T> {
  /**
   * Decode a string representation into a typed object.
   *
   * @param data Raw string data to decode (e.g., JSON, XML, CSV)
   * @returns Decoded object of type T
   * @throws Should throw an error if decoding fails
   */
  decode(data: string): T;
}

/**
 * Encoder interface for converting typed objects to string representation.
 * Provides a contract for serializing output data for various destinations.
 *
 * @template T The source type before encoding
 */
export interface Encoder<T> {
  /**
   * Encode a typed object into string representation.
   *
   * @param data Typed object to encode
   * @returns String representation of the object (e.g., JSON, XML, CSV)
   */
  encode(data: T): string;
}

/**
 * Input signature configuration for a task.
 * Defines the schema and decoding mechanism for task input.
 *
 * @template IS Input schema type
 */
export type InputSignature<IS> = {
  /** Optional schema definition for input validation */
  schema?: IS;
  /** Optional decoder for converting string input to typed data */
  decoder?: Decoder<IS>;
};

/**
 * Output signature configuration for a task.
 * Defines the schema and encoding mechanism for task output.
 *
 * @template OS Output schema type
 */
export type OutputSignature<OS> = {
  /** Optional schema definition for output validation */
  schema?: OS;
  /** Optional encoder for converting typed output to string */
  encoder?: Encoder<OS>;
};

/**
 * Complete signature configuration combining input and output specifications.
 * Used to define the data flow contract for a task.
 *
 * @template P Parameter schema type
 * @template IS Input schema type
 * @template OS Output schema type
 */
export type Signature<P extends ParamSchema, IS, OS> = {
  /** Optional parameter schema for input validation */
  param?: P;
  /** Input signature configuration */
  input?: InputSignature<IS>;
  /** Output signature configuration */
  output?: OutputSignature<OS>;
};

/**
 * Task handler function type.
 * Defines the contract for task implementation with effect capabilities.
 *
 * @template P Parameter data type
 * @template I Input data type
 * @template O Output data type
 */
export type Handler<P, I, O> = (param: P, input: I, effect: Effect) => Promise<O>;

/**
 * Pure function type without effect capabilities.
 * Represents a simplified task execution interface.
 *
 * @template P Parameter data type
 * @template I Input data type
 * @template O Output data type
 */
export type Func<P, I, O> = (param: P, input: I) => Promise<O>;

/**
 * Higher Kinded Type (HKT) interface for schema-to-type mapping.
 * This interface is designed to be extended via module augmentation
 * to provide type-safe schema resolution.
 *
 * @template T Schema type to be mapped to concrete TypeScript type
 */
// deno-lint-ignore no-empty-interface
export interface SchemaToType<T> {}

/**
 * Lask - A type-safe task runner with schema validation and CLI integration.
 *
 * This class provides a framework for defining, registering, and executing tasks
 * with strong type safety through Higher Kinded Types (HKT) and schema validation.
 *
 * Features:
 * - Type-safe task registration and execution
 * - Schema-based input/output validation
 * - Automatic CLI command generation from registered tasks
 * - Effect system for side effects and logging
 * - Pluggable encoder/decoder system for data transformation
 * - HKT-based type mapping for compile-time safety
 *
 * @template ISS Input Schema Set - The universe of possible input schemas
 * @template OSS Output Schema Set - The universe of possible output schemas
 */
export class Lask<ISS, OSS> {
  /** Logger instance for task execution monitoring and debugging */
  private logger: LaskLogger = new LaskLogger("Main");

  /**
   * Registry of registered tasks with their functions and signatures.
   * Maps task names to their execution functions and metadata.
   */
  private tasks: {
    // deno-lint-ignore no-explicit-any
    [key: string]: { func: Func<any, any, any>; signature: Signature<ParamSchema, ISS, OSS> };
  } = {};

  /**
   * Register a new task with type-safe schema validation.
   *
   * This method uses Higher Kinded Types (HKT) to ensure compile-time type safety
   * between the schema definitions and the actual handler implementation.
   * The registered task can be executed both directly as a function and through the CLI.
   *
   * @template P Parameter Schema
   * @template IS Input Schema - Must extend the input schema set (ISS)
   * @template IT Input Type - The resolved TypeScript type from input schema
   * @template OS Output Schema - Must extend the output schema set (OSS)
   * @template OT Output Type - The resolved TypeScript type from output schema
   *
   * @param name Unique identifier for the task (used as CLI command name)
   * @param signature Input/output signature configuration with optional schemas and codecs
   * @param handler Task implementation that processes input and produces output
   *
   * @returns A pure function that can be called directly without effects
   */
  task<
    P extends ParamSchema,
    IS extends ISS,
    IT extends keyof SchemaToType<IS>,
    OS extends OSS,
    OT extends keyof SchemaToType<OS>,
  >(
    name: string,
    signature: Signature<P, IS, OS>,
    handler: Handler<ParamType<P>, SchemaToType<IS>[IT], SchemaToType<OS>[OT]>,
  ): Func<ParamType<P>, SchemaToType<IS>[IT], SchemaToType<OS>[OT]> {
    const effect = new Effect(`Task#${name}`);
    const func = (
      param: ParamType<P>,
      input: SchemaToType<IS>[IT],
    ): Promise<SchemaToType<OS>[OT]> => handler(param, input, effect);
    this.tasks[name] = {
      func,
      signature,
    };
    return func;
  }

  /**
   * Launch the Lask CLI application.
   *
   * This method transforms all registered tasks into CLI commands and starts
   * the command-line interface. It handles:
   *
   * - Automatic task discovery from registered tasks
   * - Command-line argument parsing using cmd-ts
   * - Stdin input processing with registered decoders
   * - Task execution with proper error handling
   * - Output formatting using registered encoders
   * - Subcommand-based task routing
   *
   * The CLI supports:
   * - `deno run app.ts <taskname>` - Execute a specific task
   * - `echo "input" | deno run app.ts <taskname>` - Execute with stdin input
   * - `deno run app.ts --help` - List available commands
   *
   * @throws Will throw an error if task execution fails or CLI parsing fails
   */
  async bite() {
    // deno-lint-ignore no-explicit-any
    const commands: { [key: string]: any } = {};
    // Build command definitions for all registered tasks
    for (const taskName of Object.keys(this.tasks)) {
      const task = this.tasks[taskName];

      // Create a cmd-ts command for each registered task
      commands[taskName] = command({
        name: taskName,
        args: Object.entries(task.signature.param ?? {})
          .reduce((acc, [name, schema]) => {
            acc[name] = positional({
              type: schema.type === "string" ? string : schema.type === "number" ? number : string,
              displayName: name,
              description: schema.description,
            });
            return acc;
            // deno-lint-ignore no-explicit-any
          }, {} as { [key: string]: any }),
        handler: async (args) => {
          // Read input from stdin if available (non-terminal mode)
          const input = Deno.stdin.isTerminal()
            ? undefined
            : new TextDecoder().decode(readAllSync(Deno.stdin));

          // Parse input using registered decoder if available
          const parsedInput = input === undefined
            ? undefined
            : task.signature.input?.decoder?.decode(input);

          // Execute the task function
          const output = await task.func(args, parsedInput);

          // Format and output result using registered encoder
          if (output !== undefined) {
            const encodedOutput = task.signature.output?.encoder?.encode(output) ??
              JSON.stringify(output);
            console.log(encodedOutput);
          }
        },
      });
    }

    // Create the main CLI application with subcommands
    const lask = subcommands({
      name: "lask",
      cmds: commands,
    });

    // Start the CLI application with provided arguments
    await run(lask, Deno.args);
  }
}
