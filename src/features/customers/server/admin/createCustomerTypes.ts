export type CreateCustomerParams = {
  adminProfileId: string;
  email?: string | null;
  fullName: string;
  companyName?: string | null;
  phone?: string | null;
  notes?: string | null;
  sendInvite?: boolean;
};

export type CreatedCustomerPayload = {
  customerId: string;
  profileId: string;
  email: string;
  fullName: string;
  companyName: string;
  phone: string | null;
  notes: string | null;
  createdAuthUser: boolean;
  createdCustomer: boolean;
  warnings: string[];
};

export type CreateCustomerResult =
  | {
      ok: true;
      customer: CreatedCustomerPayload;
      auditId: string | null;
      idempotent: boolean;
    }
  | { ok: false; code: string; message: string };
