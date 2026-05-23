import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  assertSafeLearningExport,
  improvementBacklogToCsv,
  improvementBacklogToJson,
  incidentReviewsToCsv,
  incidentReviewsToJson,
  operatorLessonsToCsv,
  operatorLessonsToJson,
  weeklyReviewToCsv,
  weeklyReviewToJson,
} from "@/features/bookings/server/admin/adminAssistedLearningExport";
import { loadAdminAssistedProductionLearning } from "@/features/bookings/server/admin/loadAdminAssistedProductionLearning";

const VALID_EXPORTS = new Set(["incidents", "weekly", "lessons", "backlog"]);

function buildFilename(exportType: string, format: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `admin-assisted-${exportType}-${date}.${format}`;
}

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const url = new URL(request.url);
  const exportType = url.searchParams.get("export")?.trim().toLowerCase() ?? "weekly";
  const format = url.searchParams.get("format")?.trim().toLowerCase() ?? "csv";

  if (!VALID_EXPORTS.has(exportType)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_EXPORT", message: "export must be incidents, weekly, lessons, or backlog." },
      { status: 400 },
    );
  }

  try {
    const learning = await loadAdminAssistedProductionLearning();

    if (exportType === "incidents") {
      if (format === "json") {
        const json = incidentReviewsToJson(learning.incidentsWithReview);
        assertSafeLearningExport(JSON.stringify(json));
        return NextResponse.json(json);
      }
      const csv = incidentReviewsToCsv(learning.incidentsWithReview);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${buildFilename("incidents", "csv")}"`,
        },
      });
    }

    if (exportType === "lessons") {
      if (format === "json") {
        const json = operatorLessonsToJson(learning.operatorLessons);
        assertSafeLearningExport(JSON.stringify(json));
        return NextResponse.json(json);
      }
      const csv = operatorLessonsToCsv(learning.operatorLessons);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${buildFilename("lessons", "csv")}"`,
        },
      });
    }

    if (exportType === "backlog") {
      if (format === "json") {
        const json = improvementBacklogToJson(learning.improvementBacklog);
        assertSafeLearningExport(JSON.stringify(json));
        return NextResponse.json(json);
      }
      const csv = improvementBacklogToCsv(learning.improvementBacklog);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${buildFilename("backlog", "csv")}"`,
        },
      });
    }

    if (format === "json") {
      const json = weeklyReviewToJson(learning.weeklyReview);
      assertSafeLearningExport(JSON.stringify(json));
      return NextResponse.json(json);
    }

    const csv = weeklyReviewToCsv(learning.weeklyReview);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildFilename("weekly-review", "csv")}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not export learning report.";
    return NextResponse.json({ ok: false, error: "EXPORT_FAILED", message }, { status: 500 });
  }
}
