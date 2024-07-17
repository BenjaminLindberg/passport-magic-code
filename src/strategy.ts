import { randomInt } from "crypto";
import { Request } from "express";
import PassportStrategy from "passport-strategy";
import { z } from "zod";
import { MemoryStorageSchema, memoryStorage } from "./memoryStorage";

export const ArgsSchema = z.object({
  secret: z.string().min(16, {
    message: "Secret must be at least 16 characters long",
  }),
  codeLength: z.number().gte(4).default(4),
  requiredFields: z.array(z.string()).default(["email"]),
  storage: MemoryStorageSchema.default(memoryStorage),
  expiresIn: z.number().default(30) /* Miunutes */,
  codeField: z.string().default("code"),
  userPrimaryKey: z.string().default("email"),
});

export const SendCodeFunctionSchema = z
  .function()
  .args(z.string(), z.number())
  .returns(z.void().or(z.promise(z.void())));

export const VerifyUserFunctionSchema = z
  .function()
  .args(z.any())
  .returns(z.any().or(z.promise(z.any())));

export const StrategySchema = z.tuple([
  ArgsSchema,
  SendCodeFunctionSchema,
  VerifyUserFunctionSchema,
]);

export const OptionsSchema = z.object({
  action: z.enum(["request", "accept"] as const),
});

const ArgTypeSchema = ArgsSchema.partial().required({
  secret: true,
});

export type Args = z.infer<typeof ArgTypeSchema>;
export type SendCodeFunction = z.infer<typeof SendCodeFunctionSchema>;
export type VerifyUserFunction = z.infer<typeof VerifyUserFunctionSchema>;
export type Options = z.infer<typeof OptionsSchema>;

class MagicCodeStrategy extends PassportStrategy.Strategy {
  name: string;
  args: z.infer<typeof ArgsSchema>;
  sendCode: SendCodeFunction;
  verifyUser: VerifyUserFunction;

  constructor(
    args: Args,
    sendCode: SendCodeFunction,
    verifyUser: VerifyUserFunction
  ) {
    const parsedArguments = StrategySchema.safeParse([
      args,
      sendCode,
      verifyUser,
    ]);

    if (!parsedArguments.success) {
      throw new Error(parsedArguments.error.message);
    }

    super();

    this.name = "magic-code";
    this.args = parsedArguments.data[0];
    this.sendCode = parsedArguments.data[1];
    this.verifyUser = parsedArguments.data[2];
  }

  async authenticate(req: Request, options: Options) {
    const parsedOptions = OptionsSchema.safeParse(options);

    if (!parsedOptions.success) {
      throw new Error(parsedOptions.error.message);
    }

    options = parsedOptions.data;

    if (options.action === "request") {
      return this.requestCode(req, options);
    }

    if (options.action === "accept") {
      return this.acceptCode(req, options);
    }

    return this.error(new Error("Unknown action"));
  }

  async requestCode(req: Request, options: Options) {
    const parsedBody = z
      .object({
        ...this.args.requiredFields.concat([this.args.userPrimaryKey]).reduce(
          (acc, cur) => ({
            ...acc,
            [cur]: z.any(),
          }),
          {}
        ),
      })
      .safeParse(req.body);

    if (!parsedBody.success) this.fail(parsedBody.error, 400);

    let user = req.body;

    const code = randomInt(
      10 ** (this.args.codeLength - 1),
      10 ** this.args.codeLength - 1
    );

    this.sendCode(user[this.args.userPrimaryKey], code);

    this.args.storage.set(user[this.args.userPrimaryKey], {
      ...(await this.args.storage.get(user[this.args.userPrimaryKey])),
      [code.toString()]: {
        expiresIn: (Date.now() + this.args.expiresIn * 60 * 1000) / 1,
        user: user,
      },
    });

    return this.pass();
  }

  async acceptCode(req: Request, options: Options) {
    const code: string | undefined = (
      (req.body &&
        this.args.codeField in req.body &&
        req.body[this.args.codeField]) ||
      (req.query &&
        this.args.codeField in req.query &&
        req.query[this.args.codeField]) ||
      (req.params &&
        this.args.codeField in req.params &&
        req.params[this.args.codeField])
    )?.toString();

    const userUID: string | undefined = (
      (req.body &&
        this.args.userPrimaryKey in req.body &&
        req.body[this.args.userPrimaryKey]) ||
      (req.query &&
        this.args.userPrimaryKey in req.query &&
        req.query[this.args.userPrimaryKey]) ||
      (req.params &&
        this.args.userPrimaryKey in req.params &&
        req.params[this.args.userPrimaryKey])
    )?.toString();

    if (!code) {
      return this.fail(
        {
          message: "The code is missing.",
        },
        404
      );
    }

    if (!userUID) {
      return this.fail(
        {
          message: "The user primary key is missing.",
        },
        404
      );
    }

    const tokens = (await this.args.storage.get(userUID)) || {};

    if (
      !(code in tokens) ||
      !tokens[code] ||
      tokens[code]?.expiresIn <= Date.now()
    ) {
      return this.fail(
        {
          message: "Token does not exist, is already used or is expired.",
        },
        400
      );
    }

    const user = tokens[code].user;

    delete tokens[code];

    Object.keys(tokens).forEach((token) => {
      if (tokens[parseInt(token)].expiresIn <= Date.now()) {
        delete tokens[parseInt(token)];
      }
    });

    await this.args.storage.set(userUID, tokens);

    return this.success(await this.verifyUser(user));
  }
}

export { Options as AuthenticationOptions, MagicCodeStrategy as Strategy };
