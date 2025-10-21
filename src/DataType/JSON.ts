import { Decoder, Encoder, SchemaToType } from "../Lask.ts";

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

export function json<T extends JSONSchema>(schema: T): Decoder<T> & Encoder<T> {
  return {
    schema(): T {
      return schema;
    },

    decode(data: string): SchemaToType<T> {
      return JSON.parse(data);
    },

    encode(data: SchemaToType<T>): string {
      return JSON.stringify(data, null, 2);
    },
  };
}

declare module "../Lask.ts" {
  interface SchemaToType<T> {
    JSONSchema: T extends JSONSchema ? JSONType<T> : never;
  }
}
