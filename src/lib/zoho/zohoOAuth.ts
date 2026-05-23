import "server-only";

import { requireZohoBooksEnv } from "./zohoEnv";

export type ZohoAuthorizationCodeExchangeResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      expiresInSec: number;
      apiDomain: string | null;
    }
  | {
      ok: false;
      httpStatus: number;
      error: string;
      message: string;
    };

type ZohoTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  api_domain?: string;
};

export function buildZohoOAuthRedirectUri(appBaseUrl: string): string {
  const base = appBaseUrl.trim().replace(/\/$/, "");
  return `${base}/api/zoho/callback`;
}

export async function exchangeZohoAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<ZohoAuthorizationCodeExchangeResult> {
  const env = requireZohoBooksEnv();
  const url = new URL(`${env.accountsServer}/oauth/v2/token`);
  url.searchParams.set("code", code);
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("client_secret", env.clientSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetch(url.toString(), { method: "POST" });
  const body = (await response.json()) as ZohoTokenResponse;

  if (!response.ok || !body.access_token || !body.refresh_token) {
    return {
      ok: false,
      httpStatus: response.status,
      error: body.error ?? "OAUTH_CODE_EXCHANGE_FAILED",
      message:
        body.error ??
        `Zoho authorization code exchange failed (${response.status}).`,
    };
  }

  return {
    ok: true,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresInSec:
      typeof body.expires_in === "number" && body.expires_in > 0
        ? body.expires_in
        : 3600,
    apiDomain: body.api_domain?.trim() || null,
  };
}
