import { Decoder, Encoder, SchemaToType } from "../Lask.ts";

export type StringSchema = { type: "string"; description?: string };

export type StringType<T extends StringSchema> = T extends { type: "string" } ? string : never;

export function string<T extends StringSchema>(description?: string): Decoder<T> & Encoder<T> {
  return {
    schema(): T {
      return { type: "string", description } as T;
    },

    decode(data: string): SchemaToType<T> {
      // deno-lint-ignore no-explicit-any
      return data as any;
    },

    encode(data: SchemaToType<T>): string {
      // deno-lint-ignore no-explicit-any
      return data as any;
    },
  };
}

declare module "../Lask.ts" {
  interface SchemaToType<T> {
    StringSchema: T extends StringSchema ? StringType<T> : never;
  }
}
