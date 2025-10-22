export const file = (path: string) => {
  return {
    write: async (data: string): Promise<void> => {
      const encoder = new TextEncoder();
      const buffer = encoder.encode(data);
      await Deno.writeFile(path, buffer);
    },
    read: async (): Promise<string> => {
      const raw = await Deno.readFile(path);
      return new TextDecoder().decode(raw);
    },
  };
};
