import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  applyPaystackUnitTestEnv,
  PAYSTACK_UNIT_TEST_SECRET,
  restorePaystackTestEnv,
  snapshotPaystackTestEnv,
} from "@/test/paystackTestEnv";
import { verifyPaystackWebhookSignature } from "./paystackClient";

const paystackEnvSnapshot = snapshotPaystackTestEnv();

describe("verifyPaystackWebhookSignature", () => {
  beforeEach(() => {
    applyPaystackUnitTestEnv();
  });

  afterEach(() => {
    restorePaystackTestEnv(paystackEnvSnapshot);
  });

  it("rejects missing signature", () => {
    expect(verifyPaystackWebhookSignature('{"event":"charge.success"}', null)).toBe(false);
  });

  it("accepts valid HMAC SHA512 signature", () => {
    const body = '{"event":"charge.success","data":{"id":1}}';
    const signature = createHmac("sha512", PAYSTACK_UNIT_TEST_SECRET)
      .update(body)
      .digest("hex");
    expect(verifyPaystackWebhookSignature(body, signature)).toBe(true);
  });

  it("rejects tampered body", () => {
    const body = '{"event":"charge.success"}';
    const signature = createHmac("sha512", PAYSTACK_UNIT_TEST_SECRET)
      .update(body)
      .digest("hex");
    expect(verifyPaystackWebhookSignature(body + " ", signature)).toBe(false);
  });
});
