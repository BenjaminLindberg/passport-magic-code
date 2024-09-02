import { z } from "zod";

const TokenSchema = z.object({
  expiresIn: z.number(),
  user: z.any(),
});

export const MemoryStorageSchema = z.object({
  set: z.function().args(z.string(), TokenSchema),
  get: z
    .function()
    .args(z.string())
    .returns(z.promise(TokenSchema.or(z.undefined())).or(z.undefined())),
  delete: z.function().args(z.string()),
  codes: z.record(z.string(), TokenSchema).default({}),
});

export type MemoryStorage = z.infer<typeof MemoryStorageSchema>;

export const memoryStorage: MemoryStorage = {
  codes: {},

  get: async (key) => {
    return memoryStorage.codes[key];
  },
  set: async (key, value) => {
    return (memoryStorage.codes[key] = value);
  },
  delete: async (key) => {
    return delete memoryStorage.codes[key];
  },
};
