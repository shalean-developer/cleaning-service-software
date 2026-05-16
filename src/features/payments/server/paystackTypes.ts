export type PaystackInitializeRequest = {
  email: string;
  amount: number;
  reference: string;
  currency?: string;
  callback_url?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type PaystackInitializeData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data: PaystackInitializeData;
};

export type PaystackVerifyData = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency?: string;
  paid_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data: PaystackVerifyData;
};

export type PaystackWebhookEvent = {
  event: string;
  data: PaystackVerifyData & {
    gateway_response?: string;
  };
};

export type PaystackChargeSuccess = {
  reference: string;
  amountCents: number;
  providerEventId: string;
  transactionId: number;
  metadata: Record<string, unknown>;
};
