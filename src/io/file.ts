import { Reader, Writer } from "../lask.ts";

export const writeFile = (path: string): Writer => async (data: string): Promise<void> => {
  await Deno.writeTextFile(path, data);
};

export const readFile = (path: string): Reader => (): Promise<string> => {
  return Deno.readTextFile(path);
};
