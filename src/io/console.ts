import { readAll } from "jsr:@std/io@0.225.2/read-all";
import { Reader, Writer } from "../lask.ts";

export const stdin: Reader = async (): Promise<string> => {
  const data = await readAll(Deno.stdin);
  return new TextDecoder().decode(data);
};

export const stdout: Writer = (data: string): void => {
  console.log(data);
};

export const stderr: Writer = (data: string): void => {
  console.error(data);
};
