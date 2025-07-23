// testMemoryStorageSchema.ts (only for testing!)
import { z } from "zod";
import { memoryStorage } from "./memoryStorage";
import { ArgsSchema } from "./schemas";

export const TestMemoryStorageSchema = z
  .object({
    set: z.any(),
    get: z.any(),
    delete: z.any(),
    codes: z.record(z.string(), z.any()).default({}),
  })
  .default(memoryStorage);

const TestArgsSchema = ArgsSchema.extend({
  storage: TestMemoryStorageSchema,
});

export const TestStrategySchema = z.tuple([TestArgsSchema, z.any(), z.any()]);

export type TestArgs = z.infer<typeof TestArgsSchema>;
