import { readAll } from "jsr:@std/io/read-all";
import { Reader } from "../Lask.ts";

export const stdin: Reader = {
  read(): Promise<Uint8Array> {
    return readAll(Deno.stdin);
  },
};

export const stdout = {
  write: async (data: Uint8Array): Promise<void> => {
    await Deno.stdout.write(data);
  },
};

export const stderr = {
  write: async (data: Uint8Array): Promise<void> => {
    await Deno.stderr.write(data);
  },
};
