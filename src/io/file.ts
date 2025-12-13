import { Reader, Writer } from "../lask.ts";

export const file = (path: string): Reader & Writer => {
  return {
    write: async (data: string): Promise<void> => {
      await Deno.writeTextFile(path, data);
    },
    read: (): Promise<string> => {
      return Deno.readTextFile(path);
    },
  };
};
