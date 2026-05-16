"use server";

import { redirect } from "next/navigation";
import {
  buildCustomerSetupRedirectPath,
  checkCustomerReadiness,
  homePathForRole,
  resolvePostSignInPath,
} from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CustomerSetupRetryResult =
  | { ok: true }
  | { ok: false; error: string; message: string };

export async function retryCustomerProvisioning(): Promise<CustomerSetupRetryResult> {
  const readiness = await checkCustomerReadiness();

  if (readiness.status === "unauthenticated") {
    return { ok: false, error: "UNAUTHORIZED", message: "Sign in to continue." };
  }

  if (readiness.status === "wrong_role") {
    return { ok: false, error: "FORBIDDEN", message: "This page is for customer accounts only." };
  }

  if (readiness.status === "ready") {
    return { ok: true };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      error: "AUTH_NOT_CONFIGURED",
      message: "Account services are temporarily unavailable. Try again shortly.",
    };
  }

  const { data: customerId, error } = await client.rpc("ensure_customer_provisioned", {
    profile_id: readiness.user.profileId,
  });

  if (error) {
    return {
      ok: false,
      error: "REPAIR_FAILED",
      message: "We could not finish account setup. Please try again.",
    };
  }

  if (!customerId) {
    return {
      ok: false,
      error: "PROVISIONING_INCOMPLETE",
      message: "Account setup is still incomplete. Please try again.",
    };
  }

  return { ok: true };
}

export async function redirectAfterCustomerSetup(redirectedFrom?: string | null): Promise<never> {
  const readiness = await checkCustomerReadiness();
  if (readiness.status === "wrong_role") {
    redirect(homePathForRole(readiness.user.role));
  }
  if (readiness.status === "ready") {
    redirect(resolvePostSignInPath("customer", redirectedFrom));
  }
  redirect(buildCustomerSetupRedirectPath(redirectedFrom));
}
