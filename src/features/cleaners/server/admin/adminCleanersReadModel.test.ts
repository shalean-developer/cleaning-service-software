import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import {
  listAdminCleaners,
  matchesOperationalFilter,
  normalizeAdminCleanerFilter,
} from "./adminCleanersReadModel";

const customerUser: CurrentUser = {
  profileId: "profile-customer",
  role: "customer",
  authUser: { id: "auth-customer" } as CurrentUser["authUser"],
};

describe("adminCleanersReadModel filters", () => {
  it("normalizes unknown filter to all", () => {
    expect(normalizeAdminCleanerFilter(undefined)).toBe("all");
    expect(normalizeAdminCleanerFilter("bogus")).toBe("all");
  });

  it("accepts valid operational filters", () => {
    expect(normalizeAdminCleanerFilter("suspended")).toBe("suspended");
    expect(normalizeAdminCleanerFilter("archived")).toBe("archived");
  });

  it("matches operational state to filter", () => {
    expect(matchesOperationalFilter("active", "all")).toBe(true);
    expect(matchesOperationalFilter("active", "active")).toBe(true);
    expect(matchesOperationalFilter("active", "suspended")).toBe(false);
    expect(matchesOperationalFilter("archived", "archived")).toBe(true);
  });

  it("rejects non-admin list access", async () => {
    const result = await listAdminCleaners(customerUser);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FORBIDDEN");
      expect(result.status).toBe(403);
    }
  });
});
