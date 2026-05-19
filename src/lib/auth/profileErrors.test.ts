import { afterEach, describe, expect, it, vi } from "vitest";
import { missingProfileMessage } from "./profileErrors";

describe("missingProfileMessage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns production-safe copy in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(missingProfileMessage()).toContain("contact support");
    expect(missingProfileMessage()).not.toContain("e2e:seed");
  });

  it("mentions e2e:seed in non-production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(missingProfileMessage()).toContain("e2e:seed");
  });
});
