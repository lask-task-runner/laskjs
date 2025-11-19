import { Decoder, Encoder, JSONType } from "../Lask.ts";

export function string(
  description?: string,
):
  & Decoder<{ type: "string"; description?: string }>
  & Encoder<{ type: "string"; description?: string }> {
  const schema = { type: "string" as const, description };
  return {
    schema() {
      return schema;
    },

    decode(data: Uint8Array): JSONType<typeof schema> {
      return new TextDecoder().decode(data);
    },

    encode(data: JSONType<typeof schema>): Uint8Array {
      return new TextEncoder().encode(data);
    },
  };
}
