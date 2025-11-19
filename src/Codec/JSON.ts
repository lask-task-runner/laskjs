import { Decoder, Encoder, JSONSchema, JSONType } from "../Lask.ts";

export function json<T extends JSONSchema>(schema: T): Decoder<T> & Encoder<T> {
  return {
    schema(): T {
      return schema;
    },

    decode(data: Uint8Array): JSONType<T> {
      return JSON.parse(new TextDecoder().decode(data));
    },

    encode(data: JSONType<T>): Uint8Array {
      return new TextEncoder().encode(JSON.stringify(data, null, 2));
    },
  };
}
