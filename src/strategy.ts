import { randomInt } from "crypto";
import { Request } from "express";
import PassportStrategy from "passport-strategy";
import { z } from "zod";
import { lookup } from "./helpers";
import { MemoryStorageSchema, memoryStorage } from "./helpers/memoryStorage";

export const ArgsSchema = z.object({
  secret: z.string().min(16, {
    message: "Secret must be at least 16 characters long",
  }),
  codeLength: z.number().gte(4).default(4),
  storage: MemoryStorageSchema.default(memoryStorage),
  expiresIn: z.number().default(30) /* Minutes */,
  codeField: z.string().default("code"),
  userPrimaryKey: z.string().default("email"),
});

export const OptionsSchema = z.object({
  action: z.enum(["callback", "login", "register"] as const),
});

export const SendCodeSchema = z
  .function()
  .args(z.any(), z.number(), OptionsSchema)
  .returns(z.any().or(z.any().promise()));

export const CallbackSchema = z
  .function()
  .args(z.any(), OptionsSchema)
  .returns(z.any().or(z.any().promise()));

export const StrategySchema = z.tuple([
  ArgsSchema,
  SendCodeSchema,
  CallbackSchema,
]);

const ArgTypeSchema = ArgsSchema.partial().required({
  secret: true,
});

export type Args = z.infer<typeof ArgTypeSchema>;
export type SendCodeFunction = z.infer<typeof SendCodeSchema>;
export type CallbackFunction = z.infer<typeof CallbackSchema>;

export type Options = z.infer<typeof OptionsSchema>;

class MagicCodeStrategy extends PassportStrategy.Strategy {
  name: string;
  args: z.infer<typeof ArgsSchema>;
  sendCode: SendCodeFunction;
  callback: CallbackFunction;

  constructor(
    args: Args,
    sendCode: SendCodeFunction,
    callback: CallbackFunction
  ) {
    const parsedArguments = StrategySchema.safeParse([
      args,
      sendCode,
      callback,
    ]);

    if (!parsedArguments.success) {
      throw new Error(parsedArguments.error.message);
    }

    super();

    this.name = "magic-code";
    this.args = parsedArguments.data[0];
    this.sendCode = parsedArguments.data[1];
    this.callback = parsedArguments.data[2];
  }

  async authenticate(req: Request, options: Options) {
    const parsedOptions = OptionsSchema.safeParse(options);

    if (!parsedOptions.success) {
      throw new Error(parsedOptions.error.message);
    }

    options = parsedOptions.data;

    if (options.action === "callback") {
      return this.acceptCode(req, options);
    }

    if (options.action === "register" || options.action === "login") {
      return this.requestCode(req, options);
    }

    return this.error(new Error("Unknown action"));
  }

  async requestCode(req: Request, options: Options) {
    const parsedBody = z
      .object({
        [this.args.userPrimaryKey]: z.string(),
      })
      .safeParse(req.body);

    if (!parsedBody.success) this.fail(parsedBody.error, 400);

    let user = req.body;

    const code = randomInt(
      10 ** (this.args.codeLength - 1),
      10 ** this.args.codeLength - 1
    );

    /* Defined if error occured, else null */
    const error = await this.sendCode(user, code, options);

    if (error) {
      throw error;
    }

    await this.args.storage.set(code.toString(), {
      expiresIn: (Date.now() + this.args.expiresIn * 60 * 1000) / 1,
      user:
        options.action === "register"
          ? user
          : {
              [this.args.userPrimaryKey]: user[this.args.userPrimaryKey],
            },
    });

    this.pass();
    return user;
  }

  async acceptCode(req: Request, options: Options) {
    const code = lookup(
      [req.body, req.query, req.params],
      this.args.codeField
    )?.toString();

    const userUID = lookup(
      [req.body, req.query, req.params],
      this.args.userPrimaryKey
    )?.toString();

    if (!code) {
      throw {
        error: `Missing field: ${this.args.codeField}`,
        message: `The code field (${this.args.codeField}) is missing.`,
        statusCode: 400,
      };
    }
    if (!userUID) {
      throw {
        error: `Missing field: ${this.args.userPrimaryKey}`,
        message: `The primary key (${this.args.userPrimaryKey}) is missing.`,
        statusCode: 400,
      };
    }

    const token = await this.args.storage.get(code);

    console.log(token?.user, userUID);

    if (
      !token ||
      !(this.args.userPrimaryKey in token?.user) ||
      !token?.user[this.args.userPrimaryKey as keyof typeof token.user] ||
      token?.user[this.args.userPrimaryKey as keyof typeof token.user] !==
        userUID ||
      token?.expiresIn <= Date.now()
    ) {
      throw {
        error: "Invalid code",
        message: "Code does not exist, is already used or is expired.",
        statusCode: 400,
      };
    }

    await this.args.storage.delete(code);

    return this.success(await this.callback(token.user, options));
  }
}

export { Options as AuthenticationOptions, MagicCodeStrategy as Strategy };
