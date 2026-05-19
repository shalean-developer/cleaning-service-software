import type { ServiceSlug } from "@/features/pricing/server/types";

export type CreateCleanerParams = {
  adminProfileId: string;
  fullName: string;
  phone: string;
  password: string;
  confirmPassword: string;
  serviceAreasInput: string;
  capabilities: ServiceSlug[];
  idempotencyKey?: string | null;
};

export type CreateCleanerSuccess = {
  ok: true;
  cleanerId: string;
  auditId: string | null;
  message: string;
};

export type CreateCleanerFailure = {
  ok: false;
  code: string;
  message: string;
};

export type CreateCleanerResult = CreateCleanerSuccess | CreateCleanerFailure;
