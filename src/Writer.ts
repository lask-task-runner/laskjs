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
