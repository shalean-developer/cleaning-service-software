"use client";

import type { CleanerOperationalState } from "@/features/cleaners/server/lifecycle/operationalState";
import type { AdminCleanerSafetyCounts } from "@/features/cleaners/server/admin/types";
import { AdminEntityDeleteDangerZone } from "./AdminEntityDeleteDangerZone";

type Props = {
  cleanerId: string;
  operationalState: CleanerOperationalState;
  active: boolean;
  deletedAt: string | null;
  safetyCounts: AdminCleanerSafetyCounts;
};

export function AdminCleanerDeleteDangerZone({
  cleanerId,
  operationalState,
  active,
  deletedAt,
  safetyCounts,
}: Props) {
  const isArchived = operationalState === "archived";
  const mustDeactivateFirst = active && !isArchived;
  const activeBookingsBlock = safetyCounts.activeBookingsCount > 0;

  let deleteBlockedMessage: string | null = null;
  if (mustDeactivateFirst) {
    deleteBlockedMessage =
      "Deactivate the cleaner before archiving. This removes them from the assignment pool and is required for production safety.";
  } else if (activeBookingsBlock) {
    deleteBlockedMessage = `Cannot archive while ${safetyCounts.activeBookingsCount} active booking(s) are assigned or in progress.`;
  }

  if (isArchived) {
    return (
      <AdminEntityDeleteDangerZone
        entityLabel="Cleaner"
        entityId={cleanerId}
        archiveEndpoint={`/api/admin/cleaners/${cleanerId}/archive`}
        confirmPhrase="DELETE CLEANER"
        archivedAt={deletedAt}
        canArchive={false}
        canDelete={false}
        archiveDescription=""
      />
    );
  }

  return (
    <AdminEntityDeleteDangerZone
      entityLabel="Cleaner"
      entityId={cleanerId}
      archiveEndpoint={`/api/admin/cleaners/${cleanerId}/archive`}
      confirmPhrase="DELETE CLEANER"
      archivedAt={deletedAt}
      canDelete={false}
      canArchive={!mustDeactivateFirst && !activeBookingsBlock}
      deleteBlockedMessage={deleteBlockedMessage}
      archiveDescription="Archives the cleaner (soft delete), removes them from the assignment pool, and cancels open offers. Historical bookings, earnings, and payouts are preserved."
    />
  );
}
