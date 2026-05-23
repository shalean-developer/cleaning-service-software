import "server-only";

export type ZohoBooksEnv = {
  organizationId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountsServer: string;
  booksApiBaseUrl: string;
};

function readZohoBooksEnabledFlag(): boolean {
  const flag = process.env.ZOHO_BOOKS_ENABLED?.trim().toLowerCase();
  return flag !== "false" && flag !== "0";
}

export function isZohoBooksEnabled(): boolean {
  if (!readZohoBooksEnabledFlag()) return false;

  return Boolean(
    process.env.ZOHO_BOOKS_ORGANIZATION_ID?.trim() &&
      process.env.ZOHO_CLIENT_ID?.trim() &&
      process.env.ZOHO_CLIENT_SECRET?.trim() &&
      process.env.ZOHO_REFRESH_TOKEN?.trim(),
  );
}

export function requireZohoBooksEnv(): ZohoBooksEnv {
  if (!readZohoBooksEnabledFlag()) {
    throw new ZohoConfigError(
      "ZOHO_BOOKS_DISABLED",
      "Zoho Books is disabled (ZOHO_BOOKS_ENABLED=false).",
    );
  }

  const organizationId = process.env.ZOHO_BOOKS_ORGANIZATION_ID?.trim();
  if (!organizationId) {
    throw new ZohoConfigError(
      "ZOHO_BOOKS_ORGANIZATION_ID_MISSING",
      "ZOHO_BOOKS_ORGANIZATION_ID is required for Zoho Books operations.",
    );
  }

  const clientId = process.env.ZOHO_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new ZohoConfigError(
      "ZOHO_OAUTH_CREDENTIALS_MISSING",
      "ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN are required.",
    );
  }

  const accountsServer =
    process.env.ZOHO_ACCOUNTS_SERVER?.trim().replace(/\/$/, "") ||
    "https://accounts.zoho.com";

  const booksApiBaseUrl =
    process.env.ZOHO_BOOKS_API_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://www.zohoapis.com/books/v3";

  return {
    organizationId,
    clientId,
    clientSecret,
    refreshToken,
    accountsServer,
    booksApiBaseUrl,
  };
}

export class ZohoConfigError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ZohoConfigError";
  }
}
