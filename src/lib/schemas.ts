import { CallbackFunction, MemoryStorage, SendCodeFunction } from "src/types";
import z from "zod";
import { memoryStorage } from "./memoryStorage";

export const TokenSchema = z.object({
  expiresIn: z.number(),
  user: z.any(),
});

export const MemoryStorageSchema = z.object({
  set: z.custom<MemoryStorage["set"]>(),
  get: z.custom<MemoryStorage["get"]>(),
  delete: z.custom<MemoryStorage["delete"]>(),
  codes: z.record(z.string(), TokenSchema).default({}),
});

export const ArgsSchema = z.object({
  secret: z.string().min(16, {
    message: "Secret must be at least 16 characters long",
  }),
  codeLength: z.number().gte(4).default(4),
  storage: MemoryStorageSchema.default(
    memoryStorage as z.infer<typeof MemoryStorageSchema>
  ),
  expiresIn: z.number().default(30) /* Minutes */,
  codeField: z.string().default("code"),
  userPrimaryKey: z.string().default("email"),
});

export const OptionsSchema = z.object({
  action: z.enum(["callback", "login", "register"] as const),
});

export const SendCodeSchema = z.custom<SendCodeFunction>();
export const CallbackSchema = z.custom<CallbackFunction>();

export const StrategySchema = z.tuple([
  ArgsSchema,
  SendCodeSchema, // SendCodeSchema
  CallbackSchema, // CallbackSchema
]);
