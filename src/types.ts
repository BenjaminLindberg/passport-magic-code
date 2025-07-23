import z from "zod";
import { ArgsSchema, OptionsSchema, TokenSchema } from "./lib";

export type Token = z.infer<typeof TokenSchema>;

export type Args = z.output<typeof ArgsSchema> & {
  storage: MemoryStorage;
};

export type SendCodeFunction = (
  user: any,
  expiresIn: number,
  options: Options
) => any | Promise<any>;

export type CallbackFunction = (
  user: any,
  options: Options
) => any | Promise<any>;

export type Options = z.infer<typeof OptionsSchema>;

export type MemoryStorage = {
  set: (key: string, value: Token) => Promise<void>;
  get: (key: string) => Promise<Token | undefined>;
  delete: (key: string) => Promise<void>;
  codes: Record<string, z.infer<Token>>;
};
