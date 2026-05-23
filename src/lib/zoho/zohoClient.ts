import "server-only";

import { requireZohoBooksEnv, ZohoConfigError, type ZohoBooksEnv } from "./zohoEnv";
import {
  logZohoInvoiceFetchFailureDev,
  logZohoInvoicePaymentEvent,
  logZohoOAuthFailureDev,
} from "./zohoInvoicePaymentLogger";

export class ZohoApiError extends Error {
  readonly zohoResponseCode?: number;

  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    zohoResponseCode?: number,
  ) {
    super(message);
    this.name = "ZohoApiError";
    this.zohoResponseCode = zohoResponseCode;
  }
}

type OAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
};

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;
let refreshInFlight: Promise<string> | null = null;

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

function clearTokenCache(): void {
  tokenCache = null;
}

async function refreshAccessToken(env: ZohoBooksEnv): Promise<string> {
  const url = new URL(`${env.accountsServer}/oauth/v2/token`);
  url.searchParams.set("refresh_token", env.refreshToken);
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("client_secret", env.clientSecret);
  url.searchParams.set("grant_type", "refresh_token");

  const response = await fetch(url.toString(), { method: "POST" });
  const body = (await response.json()) as OAuthTokenResponse;

  if (!response.ok || !body.access_token) {
    const message =
      body.error ||
      (typeof body === "object" && body && "message" in body
        ? String((body as { message?: string }).message)
        : null) ||
      `Zoho OAuth token refresh failed (${response.status})`;

    logZohoInvoicePaymentEvent("zoho_token_refresh_failed", {
      httpStatus: response.status,
      failureCode: body.error ?? "OAUTH_REFRESH_FAILED",
    });

    logZohoOAuthFailureDev({
      httpStatus: response.status,
      zohoResponseCode: typeof body === "object" && body && "code" in body ? Number((body as { code?: number }).code) || undefined : undefined,
      zohoResponseMessage: body.error ?? message,
      endpointPath: "/oauth/v2/token",
      queryParams: {
        grant_type: "refresh_token",
        client_id: "[redacted]",
      },
      refreshTokenLength: env.refreshToken.length,
      refreshTokenLikelyTruncated: env.refreshToken.length < 60,
    });

    throw new ZohoApiError(response.status, "ZOHO_OAUTH_REFRESH_FAILED", message);
  }

  const expiresInSec =
    typeof body.expires_in === "number" && body.expires_in > 0 ? body.expires_in : 3600;

  tokenCache = {
    accessToken: body.access_token,
    expiresAtMs: Date.now() + expiresInSec * 1000,
  };

  return tokenCache.accessToken;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAtMs - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
    return tokenCache.accessToken;
  }

  if (!refreshInFlight) {
    const env = requireZohoBooksEnv();
    refreshInFlight = refreshAccessToken(env).finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

/** Clears cached OAuth token (for tests). */
export function resetZohoClientTokenCacheForTests(): void {
  clearTokenCache();
  refreshInFlight = null;
}

export async function zohoBooksFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const env = requireZohoBooksEnv();
  const accessToken = await getAccessToken();

  const url = new URL(
    path.startsWith("http") ? path : `${env.booksApiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`,
  );

  if (!path.startsWith("http") && !url.searchParams.has("organization_id")) {
    url.searchParams.set("organization_id", env.organizationId);
  }

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json()) as T & {
    code?: number;
    message?: string;
  };

  if (response.status === 401) {
    clearTokenCache();
    throw new ZohoApiError(401, "ZOHO_UNAUTHORIZED", "Zoho Books authorization failed.");
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body && "message" in body && body.message
        ? String(body.message)
        : `Zoho Books API error (${response.status})`;
    const zohoCode =
      typeof body === "object" && body && "code" in body && typeof body.code === "number"
        ? body.code
        : undefined;
    throw new ZohoApiError(response.status, "ZOHO_HTTP_ERROR", message, zohoCode);
  }

  if (
    typeof body === "object" &&
    body &&
    "code" in body &&
    typeof body.code === "number" &&
    body.code !== 0
  ) {
    throw new ZohoApiError(
      response.status,
      "ZOHO_API_ERROR",
      body.message || `Zoho Books API returned code ${body.code}.`,
      body.code,
    );
  }

  return body;
}

export function isZohoConfigError(error: unknown): error is ZohoConfigError {
  return error instanceof ZohoConfigError;
}

export function isZohoApiError(error: unknown): error is ZohoApiError {
  return error instanceof ZohoApiError;
}
