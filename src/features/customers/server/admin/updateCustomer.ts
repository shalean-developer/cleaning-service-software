import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isValidZaMobilePhone, normalizeZaMobilePhone } from "@/lib/validation/zaPhone";
import {
  isProvisioningHealthy,
  resolveCustomerDomainHealth,
} from "./customerDomainHealth";
import {
  AUDIT_UPDATE_RECORD_FAILED_WARNING,
  customerUpdatedAuditIdempotencyKey,
  hashCustomerUpdatePatch,
  recordCustomerProfileAudit,
} from "./recordCustomerProfileAudit";
import type { UpdateCustomerParams, UpdateCustomerResult } from "./updateCustomerTypes";

type CustomerRow = {
  id: string;
  profile_id: string;
  company_name: string | null;
  phone: string | null;
  notes: string | null;
  updated_at: string;
};

function displayCompanyName(
  companyName: string | null,
  profileName: string | null,
  customerId: string,
): string {
  const company = companyName?.trim();
  if (company) return company;
  const name = profileName?.trim();
  if (name) return name;
  return `Customer ${customerId.slice(0, 8)}`;
}

function buildAuditFieldSnapshot(row: Pick<CustomerRow, "company_name" | "phone" | "notes">) {
  return {
    company_name: row.company_name,
    phone: row.phone,
    notes: row.notes,
  };
}

function pickChangedFields(
  before: ReturnType<typeof buildAuditFieldSnapshot>,
  after: ReturnType<typeof buildAuditFieldSnapshot>,
): string[] {
  const changed: string[] = [];
  if (before.company_name !== after.company_name) changed.push("company_name");
  if (before.phone !== after.phone) changed.push("phone");
  if (before.notes !== after.notes) changed.push("notes");
  return changed;
}

function minimizeSnapshot(
  snapshot: ReturnType<typeof buildAuditFieldSnapshot>,
  fields: string[],
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const field of fields) {
    if (field === "company_name") out.company_name = snapshot.company_name;
    if (field === "phone") out.phone = snapshot.phone;
    if (field === "notes") out.notes = snapshot.notes;
  }
  return out;
}

export async function updateCustomer(
  params: UpdateCustomerParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<UpdateCustomerResult> {
  const { customerId, adminProfileId, patch } = params;
  const warnings: string[] = [];

  const updatePayload: {
    company_name?: string;
    phone?: string | null;
    notes?: string | null;
  } = {};

  if (patch.companyName !== undefined) {
    updatePayload.company_name = patch.companyName;
  }

  if (patch.phone !== undefined) {
    if (patch.phone === null) {
      updatePayload.phone = null;
    } else if (!isValidZaMobilePhone(patch.phone)) {
      return {
        ok: false,
        code: "INVALID_PHONE",
        message: "Enter a valid South African mobile number (e.g. 082 123 4567).",
      };
    } else {
      updatePayload.phone = normalizeZaMobilePhone(patch.phone);
    }
  }

  if (patch.notes !== undefined) {
    updatePayload.notes = patch.notes;
  }

  if (Object.keys(updatePayload).length === 0) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "At least one editable field is required.",
    };
  }

  const { data: customerRow, error: customerError } = await client
    .from("customers")
    .select("id, profile_id, company_name, phone, notes, updated_at")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: customerError.message };
  }
  if (!customerRow) {
    return { ok: false, code: "CUSTOMER_NOT_FOUND", message: "Customer not found." };
  }

  const customer = customerRow as CustomerRow;

  const [profileResult, cleanerResult] = await Promise.all([
    client
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", customer.profile_id)
      .maybeSingle(),
    client.from("cleaners").select("id").eq("profile_id", customer.profile_id).maybeSingle(),
  ]);

  if (profileResult.error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: profileResult.error.message };
  }
  if (cleanerResult.error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: cleanerResult.error.message };
  }

  const profileRole = (profileResult.data?.role as UserRole | undefined) ?? null;
  const hasCleanersRow = Boolean(cleanerResult.data);

  if (profileRole !== "customer") {
    return {
      ok: false,
      code: "ROLE_CONFLICT",
      message: "Profile role is not customer; contact details cannot be edited here.",
    };
  }

  if (hasCleanersRow) {
    return {
      ok: false,
      code: "DUAL_DOMAIN",
      message: "Profile has both customer and cleaner domain rows; ops review required.",
    };
  }

  const domainHealth = resolveCustomerDomainHealth({
    profileRole,
    hasCustomerRow: true,
    hasCleanersRow,
  });

  if (!isProvisioningHealthy(domainHealth)) {
    return {
      ok: false,
      code: "DOMAIN_UNHEALTHY",
      message: domainHealth.detail,
    };
  }

  const beforeSnapshot = buildAuditFieldSnapshot(customer);

  const { data: updatedRow, error: updateError } = await client
    .from("customers")
    .update(updatePayload)
    .eq("id", customerId)
    .select("id, profile_id, company_name, phone, notes, updated_at")
    .single();

  if (updateError || !updatedRow) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: updateError?.message ?? "Failed to update customer.",
    };
  }

  const updated = updatedRow as CustomerRow;
  const afterSnapshot = buildAuditFieldSnapshot(updated);
  const changedFields = pickChangedFields(beforeSnapshot, afterSnapshot);

  const patchHash = hashCustomerUpdatePatch(updatePayload as Record<string, unknown>);
  const idempotencyKey = customerUpdatedAuditIdempotencyKey(
    customerId,
    adminProfileId,
    patchHash,
  );

  let auditId: string | null = null;
  try {
    auditId = await recordCustomerProfileAudit(client, {
      customerId,
      adminProfileId,
      action: "customer_updated",
      outcome: "success",
      idempotencyKey,
      metadata: {
        customer_id: customerId,
        profile_id: customer.profile_id,
        admin_profile_id: adminProfileId,
        changed_fields: changedFields,
        before: minimizeSnapshot(beforeSnapshot, changedFields),
        after: minimizeSnapshot(afterSnapshot, changedFields),
      },
    });
  } catch {
    warnings.push(AUDIT_UPDATE_RECORD_FAILED_WARNING);
  }

  return {
    ok: true,
    auditId,
    customer: {
      customerId: updated.id,
      profileId: updated.profile_id,
      companyName: displayCompanyName(
        updated.company_name,
        profileResult.data?.full_name ?? null,
        updated.id,
      ),
      phone: updated.phone,
      notes: updated.notes,
      customerUpdatedAt: updated.updated_at,
      warnings,
    },
  };
}
