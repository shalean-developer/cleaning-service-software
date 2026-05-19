import { describe, expect, it } from "vitest";
import { parseAdminCustomersQueryParams } from "./parseAdminCustomersQuery";

describe("parseAdminCustomersQueryParams", () => {
  it("applies defaults for empty search params", () => {
    const parsed = parseAdminCustomersQueryParams(new URLSearchParams());
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(50);
    expect(parsed.q).toBeUndefined();
    expect(parsed.bookings).toBe("all");
    expect(parsed.health).toBe("all");
    expect(parsed.activity).toBe("all");
  });

  it("parses pagination, search, and filters", () => {
    const parsed = parseAdminCustomersQueryParams(
      new URLSearchParams({
        page: "2",
        limit: "25",
        q: "acme",
        bookings: "has_bookings",
        health: "needs_attention",
        activity: "active_last_30_days",
      }),
    );
    expect(parsed).toEqual({
      page: 2,
      limit: 25,
      q: "acme",
      bookings: "has_bookings",
      health: "needs_attention",
      activity: "active_last_30_days",
    });
  });

  it("rejects invalid page", () => {
    expect(() =>
      parseAdminCustomersQueryParams(new URLSearchParams({ page: "0" })),
    ).toThrow();
  });

  it("rejects invalid bookings filter", () => {
    expect(() =>
      parseAdminCustomersQueryParams(new URLSearchParams({ bookings: "maybe" })),
    ).toThrow();
  });

  it("rejects invalid health filter", () => {
    expect(() =>
      parseAdminCustomersQueryParams(new URLSearchParams({ health: "broken" })),
    ).toThrow();
  });

  it("rejects invalid activity filter", () => {
    expect(() =>
      parseAdminCustomersQueryParams(new URLSearchParams({ activity: "yesterday" })),
    ).toThrow();
  });
});
