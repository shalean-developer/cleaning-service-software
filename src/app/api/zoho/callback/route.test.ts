import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const exchangeMock = vi.fn();
const isZohoBooksEnabledMock = vi.fn();

vi.mock("@/lib/zoho/zohoOAuth", () => ({
  buildZohoOAuthRedirectUri: (base: string) => `${base.replace(/\/$/, "")}/api/zoho/callback`,
  exchangeZohoAuthorizationCode: (...args: unknown[]) => exchangeMock(...args),
}));

vi.mock("@/lib/zoho/zohoEnv", () => ({
  isZohoBooksEnabled: () => isZohoBooksEnabledMock(),
}));

describe("GET /api/zoho/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "development";
    process.env.APP_BASE_URL = "http://localhost:3000";
    isZohoBooksEnabledMock.mockReturnValue(true);
  });

  it("returns 403 in production", async () => {
    process.env.NODE_ENV = "production";
    const response = await GET(new Request("http://localhost:3000/api/zoho/callback?code=abc"));
    expect(response.status).toBe(403);
  });

  it("returns HTML with refresh token in development", async () => {
    exchangeMock.mockResolvedValue({
      ok: true,
      accessToken: "access",
      refreshToken: "1000.full.refresh.token.value.here",
      expiresInSec: 3600,
      apiDomain: "https://www.zohoapis.com",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/zoho/callback?code=valid-code"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("1000.full.refresh.token.value.here");
    expect(html).toContain("ZOHO_REFRESH_TOKEN");
    expect(exchangeMock).toHaveBeenCalledWith(
      "valid-code",
      "http://localhost:3000/api/zoho/callback",
    );
  });
});
