import { Reader } from "../Lask.ts";

export const arg = (i: number): Reader => ({
  read(): Promise<Uint8Array> {
    return Deno.args[i + 2]
      ? Promise.resolve(new TextEncoder().encode(Deno.args[i + 2]))
      : Promise.reject(new Error(`Argument at index ${i} is not provided.`));
  },
});
