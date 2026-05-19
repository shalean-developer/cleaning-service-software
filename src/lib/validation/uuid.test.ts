import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("accepts valid uuid", () => {
    expect(isUuid("a196947b-fc37-465d-953b-d529e9eb6ea5")).toBe(true);
  });

  it("rejects new and other slug segments", () => {
    expect(isUuid("new")).toBe(false);
    expect(isUuid("create")).toBe(false);
  });
});
