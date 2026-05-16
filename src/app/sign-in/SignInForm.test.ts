import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("SignInForm post-sign-in profile lookup", () => {
  it("scopes profile role lookup to the session user via loadProfileRoleForUser", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/sign-in/SignInForm.tsx"),
      "utf8",
    );
    expect(source).toContain("loadProfileRoleForUser");
    expect(source).toContain("auth.getUser()");
    expect(source).not.toMatch(/\.from\("profiles"\)/);
  });
});
