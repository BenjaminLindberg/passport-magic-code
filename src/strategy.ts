import { randomInt } from "crypto";
import { Request } from "express";
import { sign, verify } from "jsonwebtoken";
import PassportStrategy from "passport-strategy";
import { z } from "zod";
import { MemoryStorageSchema, memoryStorage } from "./memoryStorage";

export const ArgsSchema = z.object({
  secret: z.string().min(16, {
    message: "Secret must be at least 16 characters long",
  }),
  codeLength: z.number().gte(4).optional().default(4),
  requiredFields: z.array(z.string()),
  storage: MemoryStorageSchema.optional().default(memoryStorage),
  expiresIn: z.string(),
  tokenField: z.string().optional().default("token"),
  codeField: z.string().optional().default("code"),
  userPrimaryKey: z.string().optional().default("email"),
});

export const SendCodeFunctionSchema = z
  .function()
  .args(z.string(), z.string())
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

export type Args = z.infer<typeof ArgsSchema>;
export type SendCodeFunction = z.infer<typeof SendCodeFunctionSchema>;
export type VerifyUserFunction = z.infer<typeof VerifyUserFunctionSchema>;
export type Options = z.infer<typeof OptionsSchema>;

class MagicCodeStrategy extends PassportStrategy.Strategy {
  name: string;
  args: Args;
  sendCode: SendCodeFunction;
  verifyUser: VerifyUserFunction;

  constructor({ ...args }: Args, sendCode: () => void, verifyUser: () => any) {
    const parsedArguments = StrategySchema.safeParse([
      { args },
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
      return this.requestCode(req, options);
    }

    return this.error(new Error("Unknown action"));
  }

  async requestCode(req: Request, options: z.infer<typeof OptionsSchema>) {
    if (this.args?.requiredFields) {
      const parsedBody = z
        .object({
          ...this.args.requiredFields.reduce(
            (acc, cur) => ({
              ...acc,
              [cur]: z.any(),
            }),
            {}
          ),
        })
        .strip()
        .safeParse(req.body);

      if (!parsedBody.success) throw new Error(parsedBody.error.message);
    }

    let user = req.body;

    const code = randomInt(
      10 ** (this.args.codeLength - 1),
      10 ** this.args.codeLength - 1
    );

    let jwtToken: string | undefined;

    try {
      jwtToken = await sign(
        {
          code,
          user,
        },
        this.args.secret,
        {
          expiresIn: this.args.expiresIn,
        }
      );
    } catch (err: unknown) {
      return this.error(err as Error);
    }

    this.sendCode(user[this.args.userPrimaryKey], jwtToken);

    return this.pass();
  }

  async acceptCode(req: Request, options: z.infer<typeof OptionsSchema>) {
    const jwtToken =
      req.body[this.args.tokenField] ||
      req.query[this.args.tokenField] ||
      req.params[this.args.tokenField];

    const enteredCode =
      req.body[this.args.codeField] ||
      req.query[this.args.codeField] ||
      req.params[this.args.codeField];

    if (!jwtToken) {
      return this.fail(
        {
          message: "Token missing",
        },
        404
      );
    }

    if (!enteredCode) {
      return this.fail(
        {
          message: "The code is missing.",
        },
        404
      );
    }

    let code: number | undefined;
    let user;
    let exp;

    try {
      const verifiedToken = (await verify(jwtToken, this.args.secret)) as
        | {
            code: number;
            user: any;
            exp: any;
          }
        | undefined;

      code = verifiedToken?.code;
      user = verifiedToken?.user;
      exp = verifiedToken?.exp;
    } catch (err: unknown) {
      return this.fail({ message: (err as Error).message }, 500);
    }

    if (code !== enteredCode) {
      return this.fail(
        {
          message:
            "The code that's been entered does not match the original code.",
        },
        401
      );
    }

    user = await this.verifyUser(user);

    const userUID = user[this.args.userPrimaryKey];

    const usedTokens: any = (await this.args.storage.get(userUID)) || {};

    if (usedTokens[jwtToken as keyof typeof usedTokens]) {
      return this.fail(
        {
          message: "Token is already used",
        },
        400
      );
    }

    Object.keys(usedTokens).forEach((token) => {
      const expiration = usedTokens[token as keyof typeof usedTokens];
      if (expiration <= Date.now()) {
        delete usedTokens[token as keyof typeof usedTokens];
      }
    });

    usedTokens[jwtToken as keyof typeof usedTokens] = exp;

    await this.args.storage.set(userUID, usedTokens);

    return this.success(user);
  }
}

export default MagicCodeStrategy;
