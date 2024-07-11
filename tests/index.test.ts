import { expect, test } from "@jest/globals";
import { helloWorld } from "../src/";

test("returns hello world", () => {
  expect(helloWorld()).toBe("Hello World");
});
