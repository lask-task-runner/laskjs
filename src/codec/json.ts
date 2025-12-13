import { Decoder, Encoder, JSONType } from "../lask.ts";

export function json<T extends JSONType>(): {
  decoder: Decoder<T>;
  encoder: Encoder<T>;
} {
  return {
    decoder: (raw: string): T => {
      return JSON.parse(raw);
    },

    encoder: (raw: T): string => {
      return JSON.stringify(raw, null, 2);
    },
  };
}
