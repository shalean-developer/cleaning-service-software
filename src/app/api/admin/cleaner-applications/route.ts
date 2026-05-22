import { listAdminCleanerApplications } from "@/features/cleaner-applications/server/adminCleanerApplicationsReadModel";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return Response.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const url = new URL(request.url);
  const filter = url.searchParams.get("status") ?? "all";
  const search = url.searchParams.get("q");

  const result = await listAdminCleanerApplications(user, {
    filter: filter as "all" | "new" | "reviewing" | "approved" | "rejected" | "duplicate",
    search,
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return Response.json({ ok: true, items: result.items, filter: result.filter });
}
