export type UpdateCustomerParams = {
  customerId: string;
  adminProfileId: string;
  patch: {
    companyName?: string;
    phone?: string | null;
    notes?: string | null;
  };
};

export type UpdatedCustomerDto = {
  customerId: string;
  profileId: string;
  companyName: string;
  phone: string | null;
  notes: string | null;
  customerUpdatedAt: string;
  warnings: string[];
};

export type UpdateCustomerResult =
  | { ok: true; customer: UpdatedCustomerDto; auditId: string | null }
  | { ok: false; code: string; message: string };
