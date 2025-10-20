import { Decoder, Encoder, InputSignature, OutputSignature } from "../Lask.ts";
import { parse as yamlParse, stringify as yamlStringify } from "https://deno.land/std@0.208.0/yaml/mod.ts";

/**
 * YAML Schema definition following the same pattern as JSON Schema.
 * Supports all YAML data types including scalars, sequences, and mappings.
 */
export type YAMLSchema =
  | { type: "void"; description?: string }
  | { type: "null"; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "number"; description?: string }
  | { type: "string"; description?: string }
  | { type: "array"; elements: YAMLSchema; description?: string }
  | { type: "object"; properties: { [key: string]: YAMLSchema }; description?: string }
  | { type: "date"; description?: string }; // YAML-specific: native date support

/**
 * Type-level mapping from YAML schema to TypeScript types.
 * Converts YAML schema definitions into their corresponding runtime types.
 */
export type YAMLType<T extends YAMLSchema> = T extends { type: "void" } ? void
  : T extends { type: "null" } ? null
  : T extends { type: "boolean" } ? boolean
  : T extends { type: "number" } ? number
  : T extends { type: "string" } ? string
  : T extends { type: "date" } ? Date
  : T extends { type: "array"; elements: infer E } ? E extends YAMLSchema ? YAMLType<E>[] : never
  : T extends { type: "object"; properties: infer P }
    ? P extends { [key: string]: YAMLSchema } ? { [K in keyof P]: YAMLType<P[K]> }
    : never
  : never;

/**
 * YAML Decoder implementation using Deno's standard YAML parser.
 * Converts YAML strings to typed JavaScript objects with schema validation.
 * 
 * @template T YAML schema type for the expected structure
 */
export class YAMLDecoder<T extends YAMLSchema> implements Decoder<YAMLType<T>> {
  constructor(private schema?: T) {}

  /**
   * Decode a YAML string into a typed object.
   * 
   * @param data YAML string to parse
   * @returns Parsed and typed object
   * @throws Error if YAML parsing fails or schema validation fails
   */
  decode(data: string): YAMLType<T> {
    try {
      const parsed = yamlParse(data);
      
      // Optional schema validation could be added here
      if (this.schema) {
        this.validateAgainstSchema(parsed, this.schema);
      }
      
      return parsed as YAMLType<T>;
    } catch (error) {
      throw new Error(`YAML parsing failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Validate parsed data against the schema (basic validation).
   * 
   * @param data Parsed data to validate
   * @param schema Schema to validate against
   * @throws Error if validation fails
   */
  private validateAgainstSchema(data: unknown, schema: YAMLSchema): void {
    switch (schema.type) {
      case "void":
        if (data !== undefined) throw new Error("Expected void, got " + typeof data);
        break;
      case "null":
        if (data !== null) throw new Error("Expected null, got " + typeof data);
        break;
      case "boolean":
        if (typeof data !== "boolean") throw new Error("Expected boolean, got " + typeof data);
        break;
      case "number":
        if (typeof data !== "number") throw new Error("Expected number, got " + typeof data);
        break;
      case "string":
        if (typeof data !== "string") throw new Error("Expected string, got " + typeof data);
        break;
      case "date":
        if (!(data instanceof Date)) throw new Error("Expected Date, got " + typeof data);
        break;
      case "array":
        if (!Array.isArray(data)) throw new Error("Expected array, got " + typeof data);
        data.forEach((item, index) => {
          try {
            this.validateAgainstSchema(item, schema.elements);
          } catch (error) {
            throw new Error(`Array item ${index}: ${error instanceof Error ? error.message : error}`);
          }
        });
        break;
      case "object":
        if (typeof data !== "object" || data === null) throw new Error("Expected object, got " + typeof data);
        Object.entries(schema.properties).forEach(([key, propSchema]) => {
          this.validateAgainstSchema((data as Record<string, unknown>)[key], propSchema);
        });
        break;
    }
  }
}

/**
 * YAML Encoder implementation using Deno's standard YAML stringifier.
 * Converts typed JavaScript objects to YAML strings with proper formatting.
 * 
 * @template T YAML schema type for the source structure
 */
export class YAMLEncoder<T extends YAMLSchema> implements Encoder<YAMLType<T>> {
  private options: {
    indent?: number;
    arrayIndent?: boolean;
    skipInvalid?: boolean;
    flowLevel?: number;
  };

  constructor(options: {
    indent?: number;
    arrayIndent?: boolean;
    skipInvalid?: boolean;
    flowLevel?: number;
  } = {}) {
    this.options = {
      indent: 2,
      arrayIndent: true,
      skipInvalid: false,
      flowLevel: -1,
      ...options,
    };
  }

  /**
   * Encode a typed object into YAML string representation.
   * 
   * @param data Typed object to encode
   * @returns YAML string representation
   * @throws Error if encoding fails
   */
  encode(data: YAMLType<T>): string {
    try {
      return yamlStringify(data as Record<string, unknown>, this.options);
    } catch (error) {
      throw new Error(`YAML encoding failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

/**
 * Create a YAML input signature with schema and decoder.
 * Convenience function for defining YAML input specifications.
 * 
 * @template T YAML schema type
 * @param schema YAML schema definition
 * @param options Optional decoder options
 * @returns Input signature with YAML decoder
 */
export function YAMLInput<T extends YAMLSchema>(
  schema: T, 
  options?: { validate?: boolean }
): InputSignature<T> {
  return {
    schema,
    decoder: new YAMLDecoder<T>(options?.validate ? schema : undefined) as Decoder<T>,
  };
}

/**
 * Create a YAML output signature with schema and encoder.
 * Convenience function for defining YAML output specifications.
 * 
 * @template T YAML schema type
 * @param schema YAML schema definition
 * @param options Optional encoder formatting options
 * @returns Output signature with YAML encoder
 */
export function YAMLOutput<T extends YAMLSchema>(
  schema: T,
  options?: {
    indent?: number;
    arrayIndent?: boolean;
    skipInvalid?: boolean;
    flowLevel?: number;
  }
): OutputSignature<T> {
  return {
    schema,
    encoder: new YAMLEncoder<T>(options) as Encoder<T>,
  };
}

/**
 * Create both input and output YAML signatures with the same schema.
 * Convenience function for tasks that process YAML in both directions.
 * 
 * @template T YAML schema type
 * @param schema YAML schema definition
 * @param options Configuration for both encoding and decoding
 * @returns Object with both input and output signatures
 */
export function YAMLSignature<T extends YAMLSchema>(
  schema: T,
  options?: {
    validate?: boolean;
    indent?: number;
    arrayIndent?: boolean;
    skipInvalid?: boolean;
    flowLevel?: number;
  }
) {
  return {
    input: YAMLInput(schema, { validate: options?.validate }),
    output: YAMLOutput(schema, {
      indent: options?.indent,
      arrayIndent: options?.arrayIndent,
      skipInvalid: options?.skipInvalid,
      flowLevel: options?.flowLevel,
    }),
  };
}

// Module augmentation to register YAML schema types with the HKT system
declare module "../Lask.ts" {
  interface SchemaToType<T> {
    YAMLSchema: T extends YAMLSchema ? YAMLType<T> : never;
  }
}