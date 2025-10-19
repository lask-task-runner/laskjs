import { Decoder, Encoder, ParamSchema, Signature } from "../Lask.ts";

export type JSONSchema =
  | { type: "void"; description?: string }
  | { type: "null"; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "number"; description?: string }
  | { type: "string"; description?: string }
  | { type: "array"; elements: JSONSchema; description?: string }
  | { type: "object"; properties: { [key: string]: JSONSchema }; description?: string };

export type JSONType<T extends JSONSchema> = T extends { type: "void" } ? void
  : T extends { type: "null" } ? null
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

export function JSONSignature<P extends ParamSchema, IS extends JSONSchema, OS extends JSONSchema>(
  schema: {
    param?: P;
    input?: IS;
    output?: OS;
  },
): Signature<P, IS, OS> {
  return {
    input: {
      schema: schema.input,
      decoder: new JSONDecoder<IS>() as Decoder<IS>,
    },
    output: {
      schema: schema.output,
      encoder: new JSONEncoder<OS>() as Encoder<OS>,
    },
    param: schema.param,
  };
}

declare module "../Lask.ts" {
  interface SchemaToType<T> {
    JSONSchema: JSONType<T extends JSONSchema ? T : never>;
  }
}
