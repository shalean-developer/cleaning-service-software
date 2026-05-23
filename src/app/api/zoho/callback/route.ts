import { NextResponse } from "next/server";
import {
  buildZohoOAuthRedirectUri,
  exchangeZohoAuthorizationCode,
} from "@/lib/zoho/zohoOAuth";
import { isZohoBooksEnabled } from "@/lib/zoho/zohoEnv";
import { isZohoConfigError } from "@/lib/zoho/zohoClient";

export const runtime = "nodejs";

function resolveRedirectUri(request: Request): string {
  const configured = process.env.ZOHO_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;

  const appBaseUrl =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    new URL(request.url).origin;

  return buildZohoOAuthRedirectUri(appBaseUrl);
}

function devSetupHtml(input: {
  refreshToken: string;
  refreshTokenLength: number;
  redirectUri: string;
  apiDomain: string | null;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Zoho OAuth setup</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #111; }
    code, pre { background: #f4f4f5; border-radius: 8px; }
    pre { padding: 1rem; overflow-x: auto; word-break: break-all; white-space: pre-wrap; }
    .warn { background: #fffbeb; border: 1px solid #f59e0b; padding: 1rem; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>Zoho refresh token ready</h1>
  <p>Copy the full value below into <code>.env.local</code> as <code>ZOHO_REFRESH_TOKEN</code>, then restart <code>npm run dev</code>.</p>
  <p class="warn">This page is shown in local/dev only. Do not share the refresh token.</p>
  <p><strong>Token length:</strong> ${input.refreshTokenLength} characters (expect roughly 70+)</p>
  <p><strong>Redirect URI used:</strong> <code>${input.redirectUri}</code></p>
  ${input.apiDomain ? `<p><strong>API domain:</strong> <code>${input.apiDomain}</code></p>` : ""}
  <pre id="refresh-token">${input.refreshToken}</pre>
  <p>After updating env, test: <code>curl.exe "http://localhost:3000/api/payments/zoho-invoice/INV-001602"</code></p>
</body>
</html>`;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        ok: false,
        error: "NOT_AVAILABLE",
        message: "Complete Zoho OAuth setup in a non-production environment.",
      },
      { status: 403 },
    );
  }

  if (!isZohoBooksEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "NOT_CONFIGURED",
        message: "Zoho Books env vars are missing or disabled.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error")?.trim();
  if (oauthError) {
    return NextResponse.json(
      {
        ok: false,
        error: "ZOHO_OAUTH_DENIED",
        message: oauthError,
      },
      { status: 400 },
    );
  }

  const code = url.searchParams.get("code")?.trim();
  if (!code) {
    return NextResponse.json(
      {
        ok: false,
        error: "MISSING_CODE",
        message:
          "Missing authorization code. Start Zoho OAuth from the API Console with redirect URI matching this route.",
      },
      { status: 400 },
    );
  }

  const redirectUri = resolveRedirectUri(request);

  try {
    const result = await exchangeZohoAuthorizationCode(code, redirectUri);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          message: result.message,
          redirectUri,
          hint:
            result.error === "invalid_code"
              ? "Authorization codes expire quickly and are single-use. Re-run OAuth and ensure redirect URI matches exactly in Zoho API Console."
              : undefined,
        },
        { status: result.httpStatus >= 400 ? result.httpStatus : 502 },
      );
    }

    return new NextResponse(
      devSetupHtml({
        refreshToken: result.refreshToken,
        refreshTokenLength: result.refreshToken.length,
        redirectUri,
        apiDomain: result.apiDomain,
      }),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  } catch (error) {
    if (isZohoConfigError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Could not exchange Zoho authorization code.",
      },
      { status: 500 },
    );
  }
}
