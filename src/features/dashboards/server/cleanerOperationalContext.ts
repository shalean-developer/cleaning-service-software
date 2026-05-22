import "server-only";

import {
  resolveCleanerOperationalState,
  type CleanerOperationalState,
} from "@/features/cleaners/server/lifecycle/operationalState";
import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CleanerDashboardOperationalContext = {
  operationalState: CleanerOperationalState;
  active: boolean;
  onboardingCompletedAt: string | null;
  hasCapabilities: boolean;
  hasAvailability: boolean;
};

export async function getCleanerDashboardOperationalContext(
  user: CurrentUser,
): Promise<
  | { ok: true; context: CleanerDashboardOperationalContext }
  | { ok: false; code: string; message: string }
> {
  if (user.role !== "cleaner") {
    return { ok: false, code: "FORBIDDEN", message: "Cleaner context only." };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase is not configured.",
    };
  }

  const scope = await resolveActorScope(client, user.profileId, user.role);
  if (!scope.actingCleanerId) {
    return {
      ok: false,
      code: "PROVISIONING_INCOMPLETE",
      message: "Cleaner profile is not ready yet.",
    };
  }

  const cleanerId = scope.actingCleanerId;

  const [cleanerRes, capsRes, availRes] = await Promise.all([
    client
      .from("cleaners")
      .select("active, suspended_at, deleted_at, onboarding_completed_at")
      .eq("id", cleanerId)
      .maybeSingle(),
    client
      .from("cleaner_service_capabilities")
      .select("service_slug")
      .eq("cleaner_id", cleanerId)
      .limit(1),
    client
      .from("cleaner_availability")
      .select("id")
      .eq("cleaner_id", cleanerId)
      .limit(1),
  ]);

  if (cleanerRes.error) {
    return { ok: false, code: "FETCH_FAILED", message: cleanerRes.error.message };
  }
  if (!cleanerRes.data) {
    return { ok: false, code: "CLEANER_NOT_FOUND", message: "Cleaner record not found." };
  }

  const row = cleanerRes.data;
  const operationalState = resolveCleanerOperationalState({
    active: row.active,
    suspendedAt: row.suspended_at,
    deletedAt: row.deleted_at,
    onboardingCompletedAt: row.onboarding_completed_at,
  });

  return {
    ok: true,
    context: {
      operationalState,
      active: row.active,
      onboardingCompletedAt: row.onboarding_completed_at,
      hasCapabilities: (capsRes.data?.length ?? 0) > 0,
      hasAvailability: (availRes.data?.length ?? 0) > 0,
    },
  };
}
