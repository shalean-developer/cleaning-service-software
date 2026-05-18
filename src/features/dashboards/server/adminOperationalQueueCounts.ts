import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ADMIN_OPERATIONAL_QUEUES,
  adminOperationalQueueHref,
  type AdminOperationalQueueKey,
} from "@/features/dashboards/adminOperationalQueues";
import {
  isServerSideAssignmentFilter,
  resolveAdminAssignmentFilterSql,
} from "./adminAssignmentFilterSql";
import { applyAdminBookingsSqlFilters, normalizeAdminBookingsQuery } from "./adminBookingsListQuery";
import type { AdminBookingFilter } from "./adminOperationalHelpers";

export type AdminOperationalQueueCountItem = {
  key: AdminOperationalQueueKey;
  label: string;
  count: number;
  href: string;
  tone: "neutral" | "warning" | "danger" | "info";
};

export async function countAdminBookingsByFilter(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  filter: AdminBookingFilter,
): Promise<number> {
  const normalizedQuery = normalizeAdminBookingsQuery({ filter });
  const assignmentFilterSql = isServerSideAssignmentFilter(normalizedQuery.filter)
    ? await resolveAdminAssignmentFilterSql(client, normalizedQuery.filter)
    : {};

  let countQuery = client.from("bookings").select("*", { count: "exact", head: true });
  countQuery = applyAdminBookingsSqlFilters(countQuery, normalizedQuery, assignmentFilterSql);
  const { count, error } = await countQuery;
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function getAdminOperationalQueueCounts(
  user: CurrentUser,
): Promise<
  | { ok: true; queues: AdminOperationalQueueCountItem[] }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  try {
    const queues = await Promise.all(
      ADMIN_OPERATIONAL_QUEUES.map(async (queue) => {
        const count = await countAdminBookingsByFilter(client, queue.filter);
        return {
          key: queue.key,
          label: queue.label,
          count,
          href: adminOperationalQueueHref(queue.filter),
          tone: queue.tone,
        };
      }),
    );
    return { ok: true, queues };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Queue counts failed.";
    return { ok: false, code: "PERSISTENCE_ERROR", message, status: 500 };
  }
}
