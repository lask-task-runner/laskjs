import { readAll } from "jsr:@std/io@0.225.2/read-all";
import { Reader } from "../lask.ts";

export const stdin: Reader = {
  async read(): Promise<string> {
    const data = await readAll(Deno.stdin);
    return new TextDecoder().decode(data);
  },
};

export const stdout = {
  write: (data: string): void => {
    console.log(data);
  },
};

export const stderr = {
  write: (data: string): void => {
    console.error(data);
  },
};
