import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildZohoOAuthRedirectUri,
  exchangeZohoAuthorizationCode,
} from "./zohoOAuth";

const fetchMock = vi.fn();

describe("zohoOAuth", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.ZOHO_BOOKS_ENABLED = "true";
    process.env.ZOHO_BOOKS_ORGANIZATION_ID = "925151166";
    process.env.ZOHO_CLIENT_ID = "client";
    process.env.ZOHO_CLIENT_SECRET = "secret";
    process.env.ZOHO_REFRESH_TOKEN = "refresh";
    process.env.ZOHO_ACCOUNTS_SERVER = "https://accounts.zoho.com";
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    vi.unstubAllGlobals();
  });

  it("builds redirect URI from app base URL", () => {
    expect(buildZohoOAuthRedirectUri("http://localhost:3000/")).toBe(
      "http://localhost:3000/api/zoho/callback",
    );
  });

  it("exchanges authorization code for refresh token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "access",
        refresh_token: "1000.full.refresh.token.value.here",
        expires_in: 3600,
        api_domain: "https://www.zohoapis.com",
      }),
    });

    const result = await exchangeZohoAuthorizationCode(
      "auth-code",
      "http://localhost:3000/api/zoho/callback",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.refreshToken).toContain("1000.");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("grant_type=authorization_code"),
      { method: "POST" },
    );
  });

  it("returns safe failure when exchange fails", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: "invalid_code" }),
    });

    const result = await exchangeZohoAuthorizationCode(
      "expired-code",
      "http://localhost:3000/api/zoho/callback",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("invalid_code");
  });
});
