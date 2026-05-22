export type SupportRequestHistoryEntry = {
  key: string;
  label: string;
  at: string | null;
  actor: "customer" | "admin" | "system" | null;
  detail: string | null;
  adminOnly: boolean;
};

export function buildCustomerSupportRequestHistory(input: {
  createdAt: string;
  status: string;
  statusChangedAt: string;
  respondedAt: string | null;
  resolvedAt: string | null;
  customerResponse: string | null;
}): SupportRequestHistoryEntry[] {
  const entries: SupportRequestHistoryEntry[] = [
    {
      key: "submitted",
      label: "Submitted",
      at: input.createdAt,
      actor: "customer",
      detail: null,
      adminOnly: false,
    },
  ];

  if (input.status !== "open") {
    entries.push({
      key: "acknowledged",
      label: "Acknowledged",
      at: input.status === "acknowledged" ? input.statusChangedAt : input.respondedAt,
      actor: "admin",
      detail: null,
      adminOnly: false,
    });
  }

  if (input.status === "resolved" || input.status === "rejected") {
    entries.push({
      key: "closed",
      label: input.status === "rejected" ? "Rejected" : "Resolved",
      at: input.resolvedAt ?? input.statusChangedAt,
      actor: "admin",
      detail: input.customerResponse,
      adminOnly: false,
    });
  } else if (input.customerResponse) {
    entries.push({
      key: "team_response",
      label: "Team response",
      at: input.respondedAt ?? input.statusChangedAt,
      actor: "admin",
      detail: input.customerResponse,
      adminOnly: false,
    });
  }

  return entries.filter((e) => e.at != null);
}

export function buildAdminSupportRequestHistory(input: {
  createdAt: string;
  updatedAt: string;
  status: string;
  statusChangedAt: string;
  respondedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  customerResponse: string | null;
  adminNotes: string | null;
  notificationState?: string | null;
}): SupportRequestHistoryEntry[] {
  const customerEntries = buildCustomerSupportRequestHistory({
    createdAt: input.createdAt,
    status: input.status,
    statusChangedAt: input.statusChangedAt,
    respondedAt: input.respondedAt,
    resolvedAt: input.resolvedAt,
    customerResponse: input.customerResponse,
  });

  const adminEntries: SupportRequestHistoryEntry[] = [
    ...customerEntries,
    {
      key: "last_updated",
      label: "Last updated",
      at: input.updatedAt,
      actor: "system",
      detail: null,
      adminOnly: true,
    },
  ];

  if (input.resolvedBy) {
    adminEntries.push({
      key: "resolved_by",
      label: "Resolved by",
      at: input.resolvedAt,
      actor: "admin",
      detail: input.resolvedBy,
      adminOnly: true,
    });
  }

  if (input.adminNotes?.trim()) {
    adminEntries.push({
      key: "admin_notes",
      label: "Internal notes",
      at: input.updatedAt,
      actor: "admin",
      detail: input.adminNotes.trim(),
      adminOnly: true,
    });
  }

  if (input.notificationState) {
    adminEntries.push({
      key: "notification",
      label: "Notification",
      at: input.updatedAt,
      actor: "system",
      detail: input.notificationState,
      adminOnly: true,
    });
  }

  return adminEntries;
}
