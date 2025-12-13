import { Decoder, Encoder, JSONType } from "../lask.ts";

export function json<T extends JSONType>(): Decoder<T> & Encoder<T> {
  return {
    decode(raw: string): T {
      return JSON.parse(raw);
    },

    encode(raw: T): string {
      return JSON.stringify(raw, null, 2);
    },
  };
}
