export type PaystackChargeAuthorizationRequest = {
  email: string;
  amount: number;
  authorization_code: string;
  reference: string;
  currency?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type PaystackChargeAuthorizationResponse = {
  status: boolean;
  message: string;
  data: PaystackVerifyData;
};

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
  authorization?: PaystackAuthorization;
  customer?: PaystackCustomer;
};

export type PaystackAuthorization = {
  authorization_code?: string;
  bin?: string;
  last4?: string;
  exp_month?: string | number;
  exp_year?: string | number;
  channel?: string;
  card_type?: string;
  bank?: string;
  reusable?: boolean;
  signature?: string;
};

export type PaystackCustomer = {
  id?: number;
  customer_code?: string;
  email?: string;
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

export type PaystackChargeFailure = {
  reference: string;
  amountCents: number;
  providerEventId: string;
  transactionId: number;
  paystackStatus: string;
  gatewayResponse?: string;
  metadata: Record<string, unknown>;
};
