import type { AdminAssistedOperatorFeedback } from "./loadAdminAssistedOperatorFeedback";
import {
  ADMIN_ASSISTED_LESSON_TAGS,
  type AdminAssistedLessonCategory,
  type AdminAssistedLessonTag,
  type AdminAssistedLessonTagSummary,
  type AdminAssistedOperatorLesson,
} from "./adminAssistedOperatorLessonTypes";

const VALID_TAGS = new Set<string>(ADMIN_ASSISTED_LESSON_TAGS);

function inferCategory(feedback: AdminAssistedOperatorFeedback): AdminAssistedLessonCategory | null {
  if (feedback.lessonCategory) return feedback.lessonCategory;
  if (feedback.paymentSucceeded === false) return "payment_issue";
  if (feedback.confusingText) return "confusing_step";
  if (feedback.customerUnderstood === false) return "customer_question";
  if (feedback.slowedDownText?.toLowerCase().includes("recurring")) return "recurring_issue";
  if (feedback.slowedDownText?.toLowerCase().includes("assign")) return "cleaner_assignment_issue";
  if (feedback.notes?.toLowerCase().includes("price")) return "pricing_issue";
  return null;
}

function inferTags(feedback: AdminAssistedOperatorFeedback): AdminAssistedLessonTag[] {
  const tags = new Set<AdminAssistedLessonTag>();
  for (const tag of feedback.lessonTags ?? []) {
    if (VALID_TAGS.has(tag)) tags.add(tag as AdminAssistedLessonTag);
  }
  if (tags.size > 0) return [...tags];

  const category = inferCategory(feedback);
  if (category === "payment_issue") tags.add("payment");
  if (category === "confusing_step") tags.add("UX");
  if (category === "customer_question") tags.add("customer");
  if (category === "recurring_issue") tags.add("recurring");
  if (category === "cleaner_assignment_issue") tags.add("cleaner");
  if (category === "pricing_issue") tags.add("finance");
  if (feedback.paymentSucceeded === false) tags.add("payment");
  if (feedback.customerUnderstood === false) tags.add("training");
  return [...tags];
}

export function deriveOperatorLessonsFromFeedback(
  feedback: AdminAssistedOperatorFeedback[],
): AdminAssistedOperatorLesson[] {
  return feedback
    .filter(
      (item) =>
        item.confusingText ||
        item.slowedDownText ||
        item.notes ||
        item.lessonCategory ||
        (item.lessonTags?.length ?? 0) > 0,
    )
    .map((item) => {
      const category = inferCategory(item);
      const summary =
        item.confusingText?.trim() ||
        item.slowedDownText?.trim() ||
        item.notes?.trim()?.slice(0, 120) ||
        "Operator lesson captured";
      return {
        id: item.id,
        bookingId: item.bookingId,
        category,
        tags: inferTags(item),
        summary,
        detail: item.notes,
        createdAt: item.createdAt,
      };
    });
}

export function summarizeLessonTags(lessons: AdminAssistedOperatorLesson[]): AdminAssistedLessonTagSummary[] {
  const counts = new Map<AdminAssistedLessonTag, number>();
  for (const lesson of lessons) {
    for (const tag of lesson.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function lessonHighlights(lessons: AdminAssistedOperatorLesson[], limit = 5): string[] {
  return lessons.slice(0, limit).map((lesson) => lesson.summary);
}
