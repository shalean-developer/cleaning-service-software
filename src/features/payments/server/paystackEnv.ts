import "server-only";

export type PaystackEnv = {
  secretKey: string;
  webhookSecret: string;
  baseUrl: string;
};

function readPaystackEnabledFlag(): boolean {
  const flag = process.env.PAYSTACK_ENABLED?.trim().toLowerCase();
  return flag !== "false" && flag !== "0";
}

export function isPaystackEnabled(): boolean {
  return readPaystackEnabledFlag() && Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
}

export function requirePaystackEnv(): PaystackEnv {
  if (!readPaystackEnabledFlag()) {
    throw new PaystackConfigError("PAYSTACK_DISABLED", "Paystack is disabled (PAYSTACK_ENABLED=false).");
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new PaystackConfigError(
      "PAYSTACK_SECRET_KEY_MISSING",
      "PAYSTACK_SECRET_KEY is required for Paystack operations.",
    );
  }

  const webhookSecret =
    process.env.PAYSTACK_WEBHOOK_SECRET?.trim() || secretKey;

  const baseUrl = process.env.PAYSTACK_API_BASE_URL?.trim() || "https://api.paystack.co";

  return { secretKey, webhookSecret, baseUrl };
}

export class PaystackConfigError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PaystackConfigError";
  }
}
