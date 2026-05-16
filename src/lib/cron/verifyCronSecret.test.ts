import { afterEach, describe, expect, it } from "vitest";
import { verifyCronSecret } from "./verifyCronSecret";

describe("verifyCronSecret", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("rejects when CRON_SECRET is unset", () => {
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer secret" },
    });
    expect(verifyCronSecret(request)).toBe(false);
  });

  it("accepts Authorization bearer", () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    expect(verifyCronSecret(request)).toBe(true);
  });

  it("accepts x-cron-secret header", () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const request = new Request("http://localhost", {
      headers: { "x-cron-secret": "test-cron-secret" },
    });
    expect(verifyCronSecret(request)).toBe(true);
  });

  it("rejects wrong secret", () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer wrong" },
    });
    expect(verifyCronSecret(request)).toBe(false);
  });
});
