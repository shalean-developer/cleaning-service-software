import { describe, expect, it } from "vitest";
import { resolveProfileAvatarUrl, resolveProfileInitials } from "./profileAvatarDisplay";

describe("resolveProfileAvatarUrl", () => {
  it("reads avatar_url from user metadata", () => {
    expect(
      resolveProfileAvatarUrl({ avatar_url: "https://cdn.example/a.jpg" }),
    ).toBe("https://cdn.example/a.jpg");
  });

  it("falls back to picture", () => {
    expect(resolveProfileAvatarUrl({ picture: "https://cdn.example/p.jpg" })).toBe(
      "https://cdn.example/p.jpg",
    );
  });

  it("returns null when metadata is empty", () => {
    expect(resolveProfileAvatarUrl(null)).toBeNull();
  });
});

describe("resolveProfileInitials", () => {
  it("uses first and last name initials", () => {
    expect(resolveProfileInitials("Sam Nkosi", "sam@example.com")).toBe("SN");
  });

  it("uses first two letters of a single name", () => {
    expect(resolveProfileInitials("Sam", "sam@example.com")).toBe("SA");
  });

  it("falls back to email local part", () => {
    expect(resolveProfileInitials(null, "sam@example.com")).toBe("SA");
  });
});
