import type { ServiceSlug } from "@/features/pricing/server/types";

export type UpdateCleanerProfileParams = {
  cleanerId: string;
  adminProfileId: string;
  fullName: string;
  serviceAreasInput: string;
  capabilities: ServiceSlug[];
  idempotencyKey?: string | null;
};

export type UpdateCleanerProfileSuccess = {
  ok: true;
  cleanerId: string;
  auditId: string | null;
  message: string;
};

export type UpdateCleanerProfileFailure = {
  ok: false;
  code: string;
  message: string;
};

export type UpdateCleanerProfileResult =
  | UpdateCleanerProfileSuccess
  | UpdateCleanerProfileFailure;
