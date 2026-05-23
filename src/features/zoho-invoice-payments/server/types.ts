import "server-only";

/** Public-safe invoice snapshot for payment pages and APIs. */
export type ZohoInvoicePaymentPublicStatus =
  | "payable"
  | "paid"
  | "void"
  | "not_found"
  | "error"
  | "not_configured";

export type ZohoInvoicePaymentLineItemDto = {
  name: string;
  quantity: number | null;
  rateCents: number | null;
  totalCents: number | null;
};

export type ZohoInvoicePaymentPublicDto = {
  invoiceNumber: string;
  customerName: string | null;
  amountDueCents: number;
  currency: string;
  dueDate: string | null;
  lineItems: ZohoInvoicePaymentLineItemDto[];
  status: ZohoInvoicePaymentPublicStatus;
};

export type ZohoInvoicePaymentSuccessResult = {
  ok: true;
  invoice: ZohoInvoicePaymentPublicDto;
};

export type ZohoInvoicePaymentFailureStatus =
  | "not_configured"
  | "not_found"
  | "error";

export type ZohoInvoicePaymentFailureResult = {
  ok: false;
  status: ZohoInvoicePaymentFailureStatus;
  message: string;
  invoiceNumber: string;
};

export type ZohoInvoicePaymentInvalidResult = {
  ok: false;
  code: "INVALID_INVOICE_NUMBER";
  message: string;
};

export type FetchZohoInvoicePaymentDetailsResult =
  | ZohoInvoicePaymentSuccessResult
  | ZohoInvoicePaymentFailureResult
  | ZohoInvoicePaymentInvalidResult;
