import { readAll } from "jsr:@std/io/read-all";

export const stdin = {
  async read(): Promise<string> {
    const raw = await readAll(Deno.stdin);
    return new TextDecoder().decode(raw);
  },
};
