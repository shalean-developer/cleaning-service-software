import path from "node:path";
import { describe, expect, it } from "vitest";
import { PAYSTACK_POST_ALLOWLIST } from "@/tests/security/mutationRouteBoundaryManifest";
import { collectPostRoutes } from "@/tests/security/staticGuardSupport";

describe("paystack mutation API routes", () => {
  it("only exposes intentional paystack POST mutation routes", () => {
    const paystackApiDir = path.join(process.cwd(), "src/app/api/paystack");
    const postRoutes = collectPostRoutes(paystackApiDir);

    expect(postRoutes.sort()).toEqual([...PAYSTACK_POST_ALLOWLIST].sort());
  });
});
