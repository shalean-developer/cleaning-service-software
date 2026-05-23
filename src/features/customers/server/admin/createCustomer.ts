import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { provisionCustomerIdentity } from "@/lib/auth/provisionCustomerIdentity";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isValidZaMobilePhone, normalizeZaMobilePhone } from "@/lib/validation/zaPhone";
import { normalizeCustomerEmail } from "./parseCreateCustomerBody";
import {
  AUDIT_RECORD_FAILED_WARNING,
  customerCreatedAuditIdempotencyKey,
  recordCustomerProfileAudit,
} from "./recordCustomerProfileAudit";
import type { CreateCustomerParams, CreateCustomerResult } from "./createCustomerTypes";

const DUPLICATE_EXISTING_WARNING = "Customer already exists";

function isDuplicateReadOnlyCreate(warnings: string[]): boolean {
  return warnings.includes(DUPLICATE_EXISTING_WARNING);
}

export async function createCustomer(
  params: CreateCustomerParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CreateCustomerResult> {
  const fullName = params.fullName.trim();
  const companyName = params.companyName?.trim() || null;
  const notes = params.notes?.trim() || null;
  const phoneRaw = params.phone?.trim() || null;
  const emailInput = params.email?.trim() ?? "";

  if (!fullName) {
    return { ok: false, code: "INVALID_PAYLOAD", message: "Full name is required." };
  }

  let phoneE164: string | null = null;
  if (phoneRaw) {
    if (!isValidZaMobilePhone(phoneRaw)) {
      return {
        ok: false,
        code: "INVALID_PHONE",
        message: "Enter a valid South African mobile number (e.g. 082 123 4567).",
      };
    }
    phoneE164 = normalizeZaMobilePhone(phoneRaw);
  }

  let email = emailInput ? normalizeCustomerEmail(emailInput) : "";
  if (!email) {
    if (!phoneE164) {
      return {
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "Email or phone is required.",
      };
    }
    email = `assist+${phoneE164.replace(/\D/g, "")}@no-reply.shalean.co.za`;
  }

  if (params.sendInvite) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Send invite is not supported yet.",
    };
  }

  const identity = await provisionCustomerIdentity(client, {
    authEmail: email,
    fullName,
    companyName,
    phoneE164,
    notes,
  });

  if (!identity.ok) {
    return { ok: false, code: identity.code, message: identity.message };
  }

  const idempotent = isDuplicateReadOnlyCreate(identity.warnings);
  const responseWarnings = [...identity.warnings];

  const idempotencyKey = customerCreatedAuditIdempotencyKey(
    identity.customerId,
    params.adminProfileId,
  );

  let auditId: string | null = null;
  try {
    auditId = await recordCustomerProfileAudit(client, {
      customerId: identity.customerId,
      adminProfileId: params.adminProfileId,
      action: "customer_created",
      outcome: "success",
      idempotencyKey,
      metadata: {
        profile_id: identity.profileId,
        email: identity.email,
        createdAuthUser: identity.createdAuthUser,
        createdCustomer: identity.createdCustomer,
        createdProfile: identity.createdProfile,
        idempotent,
      },
    });
  } catch {
    responseWarnings.push(AUDIT_RECORD_FAILED_WARNING);
  }

  const [{ data: customerRow, error: customerFetchError }, { data: profileRow }] =
    await Promise.all([
      client
        .from("customers")
        .select("company_name, phone, notes")
        .eq("id", identity.customerId)
        .single(),
      client.from("profiles").select("full_name").eq("id", identity.profileId).single(),
    ]);

  if (customerFetchError || !customerRow) {
    return {
      ok: false,
      code: "PROVISION_FAILED",
      message: customerFetchError?.message ?? "Customer row not found after provisioning.",
    };
  }

  const storedFullName = profileRow?.full_name?.trim() || fullName;

  return {
    ok: true,
    idempotent,
    auditId,
    customer: {
      customerId: identity.customerId,
      profileId: identity.profileId,
      email: identity.email,
      fullName: storedFullName,
      companyName: customerRow.company_name ?? companyName ?? storedFullName,
      phone: customerRow.phone,
      notes: customerRow.notes,
      createdAuthUser: identity.createdAuthUser,
      createdCustomer: identity.createdCustomer,
      warnings: responseWarnings,
    },
  };
}
