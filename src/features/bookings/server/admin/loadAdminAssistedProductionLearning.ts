import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countUnresolvedIncidentReviews,
  listAdminAssistedIncidentReviews,
  mergeIncidentsWithReviews,
} from "./adminAssistedIncidentReviewRepository";
import type { AdminAssistedIncidentWithReview } from "./adminAssistedIncidentReviewTypes";
import { generateAdminAssistedImprovementBacklog } from "./adminAssistedImprovementBacklog";
import type { AdminAssistedImprovementBacklogItem } from "./adminAssistedImprovementBacklog";
import {
  deriveOperatorLessonsFromFeedback,
  lessonHighlights,
  summarizeLessonTags,
} from "./adminAssistedOperatorLessons";
import type { AdminAssistedOperatorLesson } from "./adminAssistedOperatorLessonTypes";
import { loadRecentAdminAssistedOperatorFeedback } from "./loadAdminAssistedOperatorFeedback";
import { loadAdminAssistedProductionStatus } from "./loadAdminAssistedProductionStatus";
import type { AdminAssistedProductionStatus } from "./loadAdminAssistedProductionStatus";
import {
  computeAdminAssistedRolloutDecision,
  type AdminAssistedRolloutDecisionRecommendation,
} from "./adminAssistedRolloutDecisionSupport";
import {
  buildAdminAssistedWeeklyRolloutReview,
  type AdminAssistedWeeklyRolloutReview,
} from "./adminAssistedWeeklyRolloutReview";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

export type AdminAssistedProductionLearning = {
  generatedAt: string;
  readOnly: true;
  production: AdminAssistedProductionStatus;
  incidentsWithReview: AdminAssistedIncidentWithReview[];
  unresolvedIncidentCount: number;
  operatorLessons: AdminAssistedOperatorLesson[];
  weeklyReview: AdminAssistedWeeklyRolloutReview;
  improvementBacklog: AdminAssistedImprovementBacklogItem[];
  rolloutDecision: AdminAssistedRolloutDecisionRecommendation;
};

export async function loadAdminAssistedProductionLearning(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminAssistedProductionLearning> {
  const [production, reviews, recentFeedback] = await Promise.all([
    loadAdminAssistedProductionStatus(client),
    listAdminAssistedIncidentReviews(client),
    loadRecentAdminAssistedOperatorFeedback(50, client),
  ]);

  const incidentsWithReview = mergeIncidentsWithReviews(production.activeIncidents, reviews);
  const unresolvedIncidentCount = countUnresolvedIncidentReviews(incidentsWithReview);
  const operatorLessons = deriveOperatorLessonsFromFeedback(recentFeedback);
  const tagSummaries = summarizeLessonTags(operatorLessons);

  const weeklyReview = buildAdminAssistedWeeklyRolloutReview({
    status: production,
    incidentsWithReview,
    unresolvedIncidentCount,
    operatorFeedbackHighlights: lessonHighlights(operatorLessons),
  });

  const rolloutDecision = computeAdminAssistedRolloutDecision({
    status: production,
    incidentsWithReview,
    unresolvedIncidentCount,
  });

  const improvementBacklog = generateAdminAssistedImprovementBacklog({
    incidents: incidentsWithReview,
    tagSummaries,
    unresolvedAlerts: production.unresolvedAlerts,
    recommendedDecision: rolloutDecision,
  });

  return {
    generatedAt: production.generatedAt,
    readOnly: true,
    production,
    incidentsWithReview,
    unresolvedIncidentCount,
    operatorLessons,
    weeklyReview,
    improvementBacklog,
    rolloutDecision,
  };
}
