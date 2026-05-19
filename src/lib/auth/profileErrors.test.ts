import { afterEach, describe, expect, it } from "vitest";
import { missingProfileMessage } from "./profileErrors";

describe("missingProfileMessage", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns production-safe copy in production", () => {
    process.env.NODE_ENV = "production";
    expect(missingProfileMessage()).toContain("contact support");
    expect(missingProfileMessage()).not.toContain("e2e:seed");
  });

  it("mentions e2e:seed in non-production", () => {
    process.env.NODE_ENV = "development";
    expect(missingProfileMessage()).toContain("e2e:seed");
  });
});
