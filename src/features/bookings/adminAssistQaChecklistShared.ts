export const ADMIN_ASSIST_QA_CHECKLIST_KEYS = [
  "customerSelectedCorrectly",
  "quoteVerified",
  "paymentRequestSent",
  "customerReceivedLink",
  "paymentConfirmed",
  "cleanerAssigned",
  "customerInformed",
  "noOpsIssue",
] as const;

export type AdminAssistQaChecklistKey = (typeof ADMIN_ASSIST_QA_CHECKLIST_KEYS)[number];

export type AdminAssistQaChecklistItems = Partial<Record<AdminAssistQaChecklistKey, boolean>>;

export const ADMIN_ASSIST_QA_CHECKLIST_LABELS: Record<AdminAssistQaChecklistKey, string> = {
  customerSelectedCorrectly: "Customer selected correctly",
  quoteVerified: "Quote verified",
  paymentRequestSent: "Payment request sent",
  customerReceivedLink: "Customer received link",
  paymentConfirmed: "Payment confirmed",
  cleanerAssigned: "Cleaner assigned",
  customerInformed: "Customer informed",
  noOpsIssue: "No ops issue encountered",
};

export type AdminAssistQaChecklist = {
  bookingId: string;
  adminProfileId: string;
  items: AdminAssistQaChecklistItems;
  updatedAt: string;
};

export function parseAdminAssistQaChecklistItems(raw: unknown): AdminAssistQaChecklistItems {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const items: AdminAssistQaChecklistItems = {};
  for (const key of ADMIN_ASSIST_QA_CHECKLIST_KEYS) {
    if (input[key] === true) items[key] = true;
    else if (input[key] === false) items[key] = false;
  }
  return items;
}

export function countAdminAssistQaChecklistCompleted(items: AdminAssistQaChecklistItems): number {
  return ADMIN_ASSIST_QA_CHECKLIST_KEYS.filter((key) => items[key] === true).length;
}
