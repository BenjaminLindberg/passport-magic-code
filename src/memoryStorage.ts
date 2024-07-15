import { z } from "zod";

const TokenSchema = z.any();

export const MemoryStorageSchema = z.object({
  set: z.function().args(z.string(), TokenSchema),
  get: z
    .function()
    .args(z.string())
    .returns(z.promise(TokenSchema.or(z.undefined()))),
  delete: z.function().args(z.string()),
  tokens: z.map(z.string(), TokenSchema),
});

export type MemoryStorage = z.infer<typeof MemoryStorageSchema>;

export const memoryStorage: MemoryStorage = {
  tokens: new Map(),

  set: async (key, value) => {
    return memoryStorage.tokens.set(key, value);
  },
  get: async (key) => {
    return memoryStorage.tokens.get(key);
  },
  delete: async (key) => {
    return memoryStorage.tokens.delete(key);
  },
};
