import { expect, test } from "@jest/globals";

import { memoryStorage } from "../src/memoryStorage";

test("storage API", () => {
  ["get", "set", "delete"].forEach((method) => {
    expect(memoryStorage[method as keyof typeof memoryStorage]).toBeInstanceOf(
      Function
    );
  });
});

test("storage set/get", async () => {
  memoryStorage.set("abc", 123);
  memoryStorage.set("another", "foo");
  const found = await memoryStorage.get("abc");
  expect(found).toBe(123);
});

test("storage delete/get", async () => {
  await memoryStorage.delete("abc");
  const abc = await memoryStorage.get("abc");
  const another = await memoryStorage.get("another");
  expect(abc).toBeUndefined();
  expect(another).toBe("foo");
});
