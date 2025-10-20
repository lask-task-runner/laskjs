import { Decoder, Encoder, InputSignature, OutputSignature } from "../Lask.ts";

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

export class JSONDecoder<T extends JSONSchema> implements Decoder<JSONType<T>> {
  decode(data: string): JSONType<T> {
    return JSON.parse(data);
  }
}

export class JSONEncoder<T extends JSONSchema> implements Encoder<JSONType<T>> {
  encode(data: JSONType<T>): string {
    return JSON.stringify(data, null, 2);
  }
}

export function JSONInput<T extends JSONSchema>(schema: T): InputSignature<T> {
  return {
    schema,
    decoder: new JSONDecoder<T>() as Decoder<T>,
  };
}

export function JSONOutput<T extends JSONSchema>(schema: T): OutputSignature<T> {
  return {
    schema,
    encoder: new JSONEncoder<T>() as Encoder<T>,
  };
}

declare module "../Lask.ts" {
  interface SchemaToType<T> {
    JSONSchema: T extends JSONSchema ? JSONType<T> : never;
  }
}
