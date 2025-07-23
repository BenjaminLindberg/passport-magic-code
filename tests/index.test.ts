import { Request } from "express";
import { lookup, memoryStorage, TestArgs } from "../src/lib";
import { Strategy as MagicCodeStrategy } from "../src/strategy";
import { MemoryStorage } from "../src/types";

type MockCodeStore = Record<string, any>;

let codes: MockCodeStore = {};

const mockStorage: MemoryStorage = {
  codes,
  set: jest.fn(async (key: string, value: any) => {
    codes[key] = value;
  }),
  get: jest.fn(async (key: string) => codes[key]),
  delete: jest.fn(async (key: string) => {
    delete codes[key];
  }),
};

const validArgs: TestArgs = {
  secret: "supersecretkey123456",
  codeLength: 6,
  storage: mockStorage,
  codeField: "code",
  userPrimaryKey: "email",
  expiresIn: 5,
} satisfies TestArgs;

const mockSendCode = jest.fn(async (user, code, options) => null);
const mockCallback = jest.fn(async (user, options) => ({
  authenticated: true,
  user,
}));

const createRequest = (body: any = {}, query = {}, params = {}): Request =>
  ({
    body,
    query,
    params,
  } as unknown as Request);

describe("MagicCodeStrategy", () => {
  let strategy: MagicCodeStrategy;

  beforeEach(() => {
    strategy = new MagicCodeStrategy(validArgs, mockSendCode, mockCallback);
    strategy.pass = jest.fn();
    strategy.success = jest.fn(async (user) => user);
    codes = {};
    jest.clearAllMocks();
  });

  it("should initialize correctly with valid inputs", () => {
    expect(strategy.name).toBe("magic-code");
    expect(strategy.args.secret).toBe(validArgs.secret);
  });

  it("should throw if args are invalid", () => {
    expect(() => {
      new MagicCodeStrategy(
        { ...validArgs, secret: "" } as any,
        mockSendCode,
        mockCallback
      );
    }).toThrow();
  });

  it("should request a code and call sendCode", async () => {
    const req = createRequest({ email: "test@example.com" });
    await strategy.requestCode(req, { action: "login" });
    expect(mockSendCode).toHaveBeenCalled();
    expect(Object.keys(codes).length).toBe(1);
  });

  it("should accept valid code and call callback", async () => {
    const code = "123456";
    const user = { email: "test@example.com" };
    await mockStorage.set(code, {
      user,
      expiresIn: Date.now() + 1000 * 60,
    });

    const req = createRequest({ code, email: "test@example.com" });
    const result = await strategy.acceptCode(req, { action: "callback" });

    expect(mockCallback).toHaveBeenCalled();
    expect(mockStorage.delete).toHaveBeenCalledWith(code);
    expect(result).toEqual({ authenticated: true, user });
  });

  it("should reject missing code", async () => {
    const req = createRequest({ email: "test@example.com" });
    await expect(
      strategy.acceptCode(req, { action: "callback" })
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("should reject expired code", async () => {
    const code = "expired";
    await mockStorage.set(code, {
      user: { email: "test@example.com" },
      expiresIn: Date.now() - 1000,
    });

    const req = createRequest({ code, email: "test@example.com" });

    await expect(
      strategy.acceptCode(req, { action: "callback" })
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("MagicCodeStrategy with default storage", () => {
  it("should use the default in-memory storage when none is provided", () => {
    const argsWithoutStorage = {
      secret: "defaultsecretthatsatleast16charslong",
      codeLength: 6,
      // no storage supplied here
      codeField: "code",
      userPrimaryKey: "email",
      expiresIn: 5,
    } as any; // bypass TS to test missing storage

    const strategy = new MagicCodeStrategy(
      argsWithoutStorage,
      mockSendCode,
      mockCallback
    );
    expect(strategy.args.storage).toBeDefined();
    // storage should have set/get/delete methods
    expect(typeof strategy.args.storage.set).toBe("function");
    expect(typeof strategy.args.storage.get).toBe("function");
    expect(typeof strategy.args.storage.delete).toBe("function");
  });
});

describe("memoryStorage", () => {
  beforeEach(() => {
    // Reset storage before each test
    memoryStorage.codes = {};
  });

  it("should store and retrieve a value", async () => {
    await memoryStorage.set("abc", {
      user: "test",
      expiresIn: Date.now() + 1000 * 60 * 5,
    });
    const val = await memoryStorage.get("abc");
    expect(val).toEqual({
      user: "test",
      expiresIn: Date.now() + 1000 * 60 * 5,
    });
  });

  it("should delete a value", async () => {
    await memoryStorage.set("abc", {
      user: "test",
      expiresIn: Date.now() + 1000 * 60 * 5,
    });
    await memoryStorage.delete("abc");
    const val = await memoryStorage.get("abc");
    expect(val).toBeUndefined();
  });

  it("should return undefined for unknown key", async () => {
    const val = await memoryStorage.get("nonexistent");
    expect(val).toBeUndefined();
  });
});

describe("lookup function", () => {
  it("should return the value of the key from first object containing it", () => {
    const arr = [
      { name: "Benjamin" },
      { email: "benjamin@example.com" },
      { age: 30 },
    ];

    expect(lookup(arr, "email")).toBe("benjamin@example.com");
    expect(lookup(arr, "name")).toBe("Benjamin");
    expect(lookup(arr, "age")).toBe(30);
  });

  it("should return undefined if key not found in any object", () => {
    const arr = [{ foo: 1 }, { bar: 2 }];
    expect(lookup(arr, "baz")).toBeUndefined();
  });

  it("should skip null or undefined objects", () => {
    const arr = [null, undefined, { key: "value" }];
    expect(lookup(arr, "key")).toBe("value");
  });
});
