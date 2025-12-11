import { Decoder, Encoder, JSONType } from "../lask.ts";

export const raw: Decoder<string> & Encoder<string> = {
  decode(data: Uint8Array): Promise<string> {
    return Promise.resolve(new TextDecoder().decode(data));
  },
  encode(data: string): Promise<Uint8Array> {
    return Promise.resolve(new TextEncoder().encode(data));
  },
};

export const stringify: Encoder<JSONType> = {
  encode(data: JSONType): Promise<Uint8Array> {
    return Promise.resolve(
      new TextEncoder().encode(JSON.stringify(data, null, 2)),
    );
  },
};
