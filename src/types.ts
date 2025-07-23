import z from "zod";
import { ArgsSchema, OptionsSchema, TokenSchema } from "./lib";

export type Token = z.infer<typeof TokenSchema>;

const _ArgsSchema = ArgsSchema.required({
  secret: true,
});
export type Args = z.output<typeof _ArgsSchema> & {
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
  set: (key: string, value: Token) => Promise<void | any>;
  get: (key: string) => Promise<Token | undefined>;
  delete: (key: string) => Promise<void | any>;
  codes: Record<string, z.infer<Token>>;
};
