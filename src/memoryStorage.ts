import { z } from "zod";

const TokenSchema = z.record(
  z.string(),
  z.object({
    expiresIn: z.number(),
    user: z.any(),
  })
);

export const MemoryStorageSchema = z.object({
  set: z.function().args(z.string(), TokenSchema),
  get: z
    .function()
    .args(z.string())
    .returns(z.promise(TokenSchema.or(z.undefined())).or(z.undefined())),
  delete: z.function().args(z.string()),
  codes: z.map(z.string(), TokenSchema).optional(),
});

export type MemoryStorage = z.infer<typeof MemoryStorageSchema>;

export const memoryStorage: MemoryStorage = {
  codes: new Map(),

  set: async (key, value) => {
    return memoryStorage.codes?.set(key, value);
  },
  get: async (key) => {
    return memoryStorage.codes?.get(key);
  },
  delete: async (key) => {
    return memoryStorage.codes?.delete(key);
  },
};
