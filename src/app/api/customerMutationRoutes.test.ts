import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectPostRoutes } from "@/tests/security/staticGuardSupport";

/** Customer checkout / payment POST mutation routes (intentional). */
const ALLOWED_CUSTOMER_POST_ROUTES = new Set([
  "bookings/lock/route.ts",
  "bookings/[bookingId]/payment-retry-lock/route.ts",
  "paystack/initialize/route.ts",
  "paystack/verify/route.ts",
]);

describe("customer mutation API routes", () => {
  it("only exposes intentional customer POST mutation routes", () => {
    const apiRoot = path.join(process.cwd(), "src/app/api");
    const postRoutes = [
      ...collectPostRoutes(path.join(apiRoot, "bookings"), "bookings"),
      ...collectPostRoutes(path.join(apiRoot, "paystack/initialize"), "paystack/initialize"),
      ...collectPostRoutes(path.join(apiRoot, "paystack/verify"), "paystack/verify"),
    ];

    expect(postRoutes.sort()).toEqual([...ALLOWED_CUSTOMER_POST_ROUTES].sort());
  });
});
