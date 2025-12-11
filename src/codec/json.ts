import { Decoder, Encoder, JSONType } from "../lask.ts";

export function json<T extends JSONType>(): Decoder<T> & Encoder<T> {
  return {
    decode(raw: Uint8Array): T {
      return JSON.parse(new TextDecoder().decode(raw)) as T;
    },

    encode(raw: T): Uint8Array {
      return new TextEncoder().encode(JSON.stringify(raw, null, 2));
    },
  };
}
