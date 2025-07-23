import { randomInt } from "crypto";
import { Request } from "express";
import PassportStrategy from "passport-strategy";

import { z } from "zod";
import { lookup, OptionsSchema, StrategySchema } from "./lib";
import { TestStrategySchema } from "./lib/testUtils";
import { Args, CallbackFunction, Options, SendCodeFunction } from "./types";

class MagicCodeStrategy extends PassportStrategy.Strategy {
  name: string;
  args: Args;
  sendCode: SendCodeFunction;
  callback: CallbackFunction;

  constructor(
    args: Args,
    sendCode: SendCodeFunction,
    callback: CallbackFunction
  ) {
    const isTest = process.env.NODE_ENV === "test";
    const parsedArguments = (
      isTest ? TestStrategySchema : StrategySchema
    ).safeParse([args, sendCode, callback]);

    if (!parsedArguments.success) {
      throw new Error(parsedArguments.error.message);
    }

    super();

    this.name = "magic-code";
    this.args = parsedArguments.data[0] as Args;
    this.sendCode = parsedArguments.data[1] satisfies SendCodeFunction;
    this.callback = parsedArguments.data[2] satisfies CallbackFunction;
  }

  /* passport-strategy does not expect new express Request type from ^5.0.0 */
  /* @ts-ignore */
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

    /* await */
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

    /* await */
    const token = await this.args.storage.get(code);

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

    /* await */
    await this.args.storage.delete(code);

    return this.success(await this.callback(token.user, options));
  }
}

export { Options as AuthenticationOptions, MagicCodeStrategy as Strategy };
