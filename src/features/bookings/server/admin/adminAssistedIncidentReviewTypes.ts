import type { AdminAssistedBookingIncident } from "./adminAssistedBookingIncidents";

export type AdminAssistedIncidentReviewStatus =
  | "open"
  | "investigating"
  | "resolved"
  | "dismissed";

export type AdminAssistedIncidentReviewRecord = {
  id: string;
  incidentKey: string;
  bookingId: string;
  category: string;
  status: AdminAssistedIncidentReviewStatus;
  severity: AdminAssistedBookingIncident["severity"];
  ownerProfileId: string | null;
  rootCauseNotes: string | null;
  resolutionNotes: string | null;
  followUpAction: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAssistedIncidentWithReview = AdminAssistedBookingIncident & {
  review: AdminAssistedIncidentReviewRecord | null;
  reviewStatus: AdminAssistedIncidentReviewStatus;
};
