import { describe, expect, it } from "vitest";
import {
  PASSWORD_RESET_REQUEST_SUCCESS_MESSAGE,
  RESET_PASSWORD_PATH,
  buildPasswordResetRedirectUrl,
  isPasswordResetEmail,
} from "./passwordReset";

describe("passwordReset", () => {
  it("builds reset-password redirect URL from origin", () => {
    expect(buildPasswordResetRedirectUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/reset-password",
    );
    expect(RESET_PASSWORD_PATH).toBe("/reset-password");
  });

  it("uses non-enumerating success copy", () => {
    expect(PASSWORD_RESET_REQUEST_SUCCESS_MESSAGE).toBe(
      "If an account exists for this email, we'll send a reset link shortly.",
    );
  });

  it("validates email addresses for reset requests", () => {
    expect(isPasswordResetEmail("user@example.com")).toBe(true);
    expect(isPasswordResetEmail("bad@@example.com")).toBe(false);
    expect(isPasswordResetEmail("0792022648")).toBe(false);
  });
});
