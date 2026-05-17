import { describe, expect, it } from "vitest";
import { classifyProviderFailure } from "./classifyProviderFailure";

describe("classifyProviderFailure", () => {
  it.each([
    ["rate limit exceeded", true],
    ["Request timeout", true],
    ["upstream 503", true],
    ["invalid email address", false],
    ["domain not verified", false],
    ["generic failure", true],
  ])("classifies %j as retryable=%s", (message, retryable) => {
    expect(classifyProviderFailure(message)).toEqual({ retryable });
  });
});
