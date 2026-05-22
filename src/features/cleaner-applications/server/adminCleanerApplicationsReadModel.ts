import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type { Database } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { formatLocationName, locationSearchTokens } from "@/features/locations/locationDisplay";
import type { CleanerApplicationRow, CleanerApplicationStatus } from "../types";

export type AdminCleanerApplicationsFilter = CleanerApplicationStatus | "all";

export type AdminCleanerApplicationListItem = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  suburb: string | null;
  city: string;
  status: CleanerApplicationStatus;
  createdAt: string;
  createdCleanerId: string | null;
};

function mapRow(row: CleanerApplicationRow): AdminCleanerApplicationListItem {
  const suburbRaw = row.suburb?.trim() || null;
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    suburb: suburbRaw ? formatLocationName(suburbRaw) : null,
    city: row.city,
    status: row.status,
    createdAt: row.created_at,
    createdCleanerId: row.created_cleaner_id,
  };
}

export async function listAdminCleanerApplications(
  user: CurrentUser,
  params: { filter?: AdminCleanerApplicationsFilter; search?: string | null } = {},
): Promise<
  | { ok: true; items: AdminCleanerApplicationListItem[]; filter: AdminCleanerApplicationsFilter }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase not configured.",
      status: 503,
    };
  }

  const filter = params.filter ?? "all";
  let query = client
    .from("cleaner_applications")
    .select(
      "id, full_name, phone, email, suburb, city, status, created_at, created_cleaner_id",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  const search = params.search?.trim().toLowerCase();
  let rows = (data ?? []) as CleanerApplicationRow[];

  if (search) {
    rows = rows.filter((row) => {
      const haystack = [
        row.full_name,
        row.phone,
        row.email ?? "",
        row.suburb ?? "",
        row.city,
        ...locationSearchTokens(row.suburb),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  return {
    ok: true,
    items: rows.map(mapRow),
    filter,
  };
}

export async function getAdminCleanerApplicationDetail(
  user: CurrentUser,
  applicationId: string,
): Promise<
  | { ok: true; application: CleanerApplicationRow }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase not configured.",
      status: 503,
    };
  }

  const { data, error } = await client
    .from("cleaner_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }
  if (!data) {
    return { ok: false, code: "NOT_FOUND", message: "Application not found.", status: 404 };
  }

  return { ok: true, application: data as CleanerApplicationRow };
}

export async function updateCleanerApplicationStatus(
  user: CurrentUser,
  applicationId: string,
  params: { status: CleanerApplicationStatus; adminNotes?: string | null },
): Promise<{ ok: true } | { ok: false; code: string; message: string; status: number }> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const serviceClient = requireServiceRoleClient();
  const patch: Database["public"]["Tables"]["cleaner_applications"]["Update"] = {
    status: params.status,
    reviewed_by: user.profileId,
    reviewed_at: new Date().toISOString(),
  };
  if (params.adminNotes !== undefined) {
    patch.admin_notes = params.adminNotes?.trim() || null;
  }

  const { error } = await serviceClient
    .from("cleaner_applications")
    .update(patch)
    .eq("id", applicationId);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  return { ok: true };
}
