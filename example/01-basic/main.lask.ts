import { json } from "../../src/Codec/JSON.ts";
import { raw, stringify } from "../../src/Codec/String.ts";
import { stdout } from "../../src/IO/Console.ts";
import { Lask } from "../../src/Lask.ts";

const lask = new Lask();

lask.resource("file", {
  resource: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The path to the file",
        from: {
          reader: lask.flags("path"),
          decoder: raw,
        },
      },
      contents: {
        type: "string",
        description: "The contents of the file",
        from: {
          reader: lask.flags("contents"),
          decoder: raw,
        },
      },
    },
  },
  create: async (resource, effect) => {
    effect.info(`Creating file at path: ${resource.id}`);
    await Deno.writeTextFile(resource.id, resource.contents);
    return resource;
  },
  read: async (id, effect) => {
    effect.info(`Reading file at path: ${id}`);
    const contents = await effect.$(`cat ${id}`);
    return {
      id,
      contents: contents.toString(),
    };
  },
  update: async (resource, _previous, effect) => {
    effect.info(`Updating file at path: ${resource.id}`);
    await effect.$(`echo "${resource.contents}" > ${resource.id}`);
    return resource;
  },
  delete: async (id, _resource, effect) => {
    effect.info(`Deleting file at path: ${id}`);
    await effect.$(`rm ${id}`);
  },
});

lask.task("add", {
  input: {
    type: "object",
    properties: {
      a: {
        type: "number",
        from: {
          reader: lask.args(0),
          decoder: json<number>(),
        },
      },
      b: {
        type: "number",
        from: {
          reader: lask.args(1),
          decoder: json<number>(),
        },
      },
    },
  },
  output: {
    type: "number",
    to: {
      encoder: stringify,
      writer: stdout,
    },
  },
  handler: ({ a, b }, effect) => {
    effect.info(`Adding two numbers: ${a} ${b}`);
    return Promise.resolve(a + b);
  },
});

lask.task("ls", {
  handler: async (_inputs, effect) => {
    effect.info("Listing current directory contents");
    await effect.$("ls -la");
    return {};
  },
});

await lask.bite();
