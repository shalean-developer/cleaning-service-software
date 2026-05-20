import { describe, expect, it } from "vitest";
import { serviceSupportsExtraRooms } from "./catalog";

describe("serviceSupportsExtraRooms", () => {
  it("returns true for services with extra room pricing", () => {
    expect(serviceSupportsExtraRooms("regular-cleaning")).toBe(true);
    expect(serviceSupportsExtraRooms("deep-cleaning")).toBe(true);
    expect(serviceSupportsExtraRooms("moving-cleaning")).toBe(true);
  });

  it("returns false for other services", () => {
    expect(serviceSupportsExtraRooms("airbnb-cleaning")).toBe(false);
    expect(serviceSupportsExtraRooms("office-cleaning")).toBe(false);
    expect(serviceSupportsExtraRooms("carpet-cleaning")).toBe(false);
  });
});
