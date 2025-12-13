import { Decoder, Encoder, JSONType } from "../lask.ts";

export const raw: Decoder<string> & Encoder<string> = (data: string) => data;

export const stringify: Encoder<JSONType> = (data: JSONType) => JSON.stringify(data, null, 2);
