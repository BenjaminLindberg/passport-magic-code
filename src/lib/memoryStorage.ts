import { MemoryStorage } from "../types";

export const memoryStorage: MemoryStorage = {
  codes: {},
  get: async (key) => {
    return (await memoryStorage.codes[key]) as ReturnType<MemoryStorage["get"]>;
  },
  set: async (key, value) => {
    return await void (memoryStorage.codes[key] = value);
  },
  delete: async (key) => {
    return await void delete memoryStorage.codes[key];
  },
};
