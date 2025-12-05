import { Decoder, Encoder, JSONSchema } from "../Lask.ts";

export function json<T extends JSONSchema>(): Decoder<T> & Encoder<T> {
  return {
    decode(raw: Uint8Array): T {
      return JSON.parse(new TextDecoder().decode(raw)) as T;
    },

    encode(raw: T): Uint8Array {
      return new TextEncoder().encode(JSON.stringify(raw, null, 2));
    },
  };
}
