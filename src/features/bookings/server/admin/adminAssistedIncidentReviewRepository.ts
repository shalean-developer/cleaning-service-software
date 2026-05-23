import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAssistedBookingIncident } from "./adminAssistedBookingIncidents";
import type {
  AdminAssistedIncidentReviewRecord,
  AdminAssistedIncidentReviewStatus,
  AdminAssistedIncidentWithReview,
} from "./adminAssistedIncidentReviewTypes";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

type ReviewRow = {
  id: string;
  incident_key: string;
  booking_id: string;
  category: string;
  status: string;
  severity: string;
  owner_profile_id: string | null;
  root_cause_notes: string | null;
  resolution_notes: string | null;
  follow_up_action: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

function mapReviewRow(row: ReviewRow): AdminAssistedIncidentReviewRecord {
  return {
    id: row.id,
    incidentKey: row.incident_key,
    bookingId: row.booking_id,
    category: row.category,
    status: row.status as AdminAssistedIncidentReviewStatus,
    severity: row.severity as AdminAssistedIncidentReviewRecord["severity"],
    ownerProfileId: row.owner_profile_id,
    rootCauseNotes: row.root_cause_notes,
    resolutionNotes: row.resolution_notes,
    followUpAction: row.follow_up_action,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdminAssistedIncidentReviews(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminAssistedIncidentReviewRecord[]> {
  const { data, error } = await client
    .from("admin_assisted_incident_reviews")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapReviewRow(row as ReviewRow));
}

export async function upsertAdminAssistedIncidentReview(input: {
  incident: AdminAssistedBookingIncident;
  status: AdminAssistedIncidentReviewStatus;
  adminProfileId: string;
  ownerProfileId?: string | null;
  rootCauseNotes?: string | null;
  resolutionNotes?: string | null;
  followUpAction?: string | null;
  client?: SupabaseClient<Database>;
}): Promise<AdminAssistedIncidentReviewRecord> {
  const client = input.client ?? requireServiceRoleClient();
  const now = new Date().toISOString();
  const isClosed = input.status === "resolved" || input.status === "dismissed";

  const payload = {
    incident_key: input.incident.id,
    booking_id: input.incident.bookingId,
    category: input.incident.category,
    status: input.status,
    severity: input.incident.severity,
    owner_profile_id: input.ownerProfileId ?? input.adminProfileId,
    root_cause_notes: input.rootCauseNotes?.trim() || null,
    resolution_notes: input.resolutionNotes?.trim() || null,
    follow_up_action: input.followUpAction?.trim() || null,
    reviewed_at: isClosed ? now : null,
    reviewed_by: isClosed ? input.adminProfileId : null,
    updated_at: now,
  };

  const { data, error } = await client
    .from("admin_assisted_incident_reviews")
    .upsert(payload, { onConflict: "incident_key" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapReviewRow(data as ReviewRow);
}

export function mergeIncidentsWithReviews(
  incidents: AdminAssistedBookingIncident[],
  reviews: AdminAssistedIncidentReviewRecord[],
): AdminAssistedIncidentWithReview[] {
  const byKey = new Map(reviews.map((review) => [review.incidentKey, review]));

  return incidents.map((incident) => {
    const review = byKey.get(incident.id) ?? null;
    return {
      ...incident,
      review,
      reviewStatus: review?.status ?? "open",
    };
  });
}

export function countUnresolvedIncidentReviews(
  incidentsWithReview: AdminAssistedIncidentWithReview[],
): number {
  return incidentsWithReview.filter(
    (item) => item.reviewStatus !== "resolved" && item.reviewStatus !== "dismissed",
  ).length;
}
