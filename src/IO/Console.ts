import { readAll } from "jsr:@std/io/read-all";

export const stdin = {
  async read(): Promise<string> {
    const raw = await readAll(Deno.stdin);
    return new TextDecoder().decode(raw);
  },
};

export const stdout = {
  write: async (data: string): Promise<void> => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    await Deno.stdout.write(buffer);
  },
};

export const stderr = {
  write: async (data: string): Promise<void> => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    await Deno.stderr.write(buffer);
  },
};
