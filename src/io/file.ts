import { Reader, Writer } from "../lask.ts";

export const file = (path: string): Reader & Writer => {
  return {
    write: async (data: Uint8Array): Promise<void> => {
      await Deno.writeFile(path, data);
    },
    read: (): Promise<Uint8Array> => {
      return Deno.readFile(path);
    },
  };
};
