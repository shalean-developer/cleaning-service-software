export const ADMIN_ASSISTED_LESSON_CATEGORIES = [
  "confusing_step",
  "customer_question",
  "payment_issue",
  "recurring_issue",
  "cleaner_assignment_issue",
  "pricing_issue",
] as const;

export type AdminAssistedLessonCategory = (typeof ADMIN_ASSISTED_LESSON_CATEGORIES)[number];

export const ADMIN_ASSISTED_LESSON_TAGS = [
  "UX",
  "payment",
  "customer",
  "cleaner",
  "recurring",
  "finance",
  "training",
  "bug",
] as const;

export type AdminAssistedLessonTag = (typeof ADMIN_ASSISTED_LESSON_TAGS)[number];

export const ADMIN_ASSISTED_LESSON_CATEGORY_LABELS: Record<AdminAssistedLessonCategory, string> = {
  confusing_step: "Confusing step",
  customer_question: "Customer question",
  payment_issue: "Payment issue",
  recurring_issue: "Recurring issue",
  cleaner_assignment_issue: "Cleaner / assignment issue",
  pricing_issue: "Pricing issue",
};

export type AdminAssistedOperatorLesson = {
  id: string;
  bookingId: string;
  category: AdminAssistedLessonCategory | null;
  tags: AdminAssistedLessonTag[];
  summary: string;
  detail: string | null;
  createdAt: string;
};

export type AdminAssistedLessonTagSummary = {
  tag: AdminAssistedLessonTag;
  count: number;
};
