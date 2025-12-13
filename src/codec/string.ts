import { Decoder, Encoder, JSONType } from "../lask.ts";

export const raw: Decoder<string> & Encoder<string> = {
  decode(data: string): string {
    return data;
  },
  encode(data: string): string {
    return data;
  },
};

export const stringify: Encoder<JSONType> = {
  encode(data: JSONType): string {
    return JSON.stringify(data, null, 2);
  },
};
