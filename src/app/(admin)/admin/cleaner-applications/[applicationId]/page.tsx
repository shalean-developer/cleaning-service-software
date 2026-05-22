import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";
import { getAdminCleanerApplicationDetail } from "@/features/cleaner-applications/server/adminCleanerApplicationsReadModel";
import { AdminCleanerApplicationActions } from "@/components/dashboard/admin/cleaner-applications/AdminCleanerApplicationActions";
import { CLEANER_AVAILABILITY_DAY_OPTIONS } from "@/features/cleaners/admin/cleanerAvailability";
import {
  formatReferencesFromMetadata,
  formatSkillsFromMetadata,
  formatWorkPreferencesFromMetadata,
} from "@/features/cleaner-applications/displayApplicationMetadata";

export const metadata: Metadata = {
  title: "Application detail | Admin",
};

type PageProps = {
  params: Promise<{ applicationId: string }>;
};

function dayLabels(days: number[]): string {
  return days
    .map((d) => CLEANER_AVAILABILITY_DAY_OPTIONS.find((o) => o.value === d)?.label ?? String(d))
    .join(", ");
}

export default async function AdminCleanerApplicationDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { applicationId } = await params;
  const result = await getAdminCleanerApplicationDetail(user, applicationId);

  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "admin")}
          description={result.message}
        />
      </AdminDashboardShell>
    );
  }

  const app = result.application;
  const meta = app.metadata ?? {};
  const workPrefsLabel = formatWorkPreferencesFromMetadata(meta);
  const skillLabels = formatSkillsFromMetadata(meta);
  const references = formatReferencesFromMetadata(meta);

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      <div className="space-y-6">
        <div>
          <Link
            href="/admin/cleaner-applications"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Applications
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{app.full_name}</h1>
          <p className="mt-1 text-sm capitalize text-zinc-500">Status: {app.status}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <dl className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 text-sm">
            <div>
              <dt className="font-medium text-zinc-500">Phone</dt>
              <dd className="text-zinc-900">{app.phone}</dd>
            </div>
            {app.email ? (
              <div>
                <dt className="font-medium text-zinc-500">Email</dt>
                <dd className="text-zinc-900">{app.email}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-zinc-500">Location</dt>
              <dd className="text-zinc-900">
                {[app.suburb, app.city].filter(Boolean).join(", ") || app.city}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Experience</dt>
              <dd className="text-zinc-900">
                {app.has_cleaning_experience ? "Yes" : "No"}
                {app.experience_level ? ` · ${app.experience_level}` : ""}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Own transport</dt>
              <dd className="text-zinc-900">
                {app.has_own_transport === null ? "-" : app.has_own_transport ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Preferred areas</dt>
              <dd className="text-zinc-900">{app.preferred_areas.join(", ") || "-"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Availability</dt>
              <dd className="text-zinc-900">{dayLabels(app.availability_days) || "-"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Work preferences</dt>
              <dd className="text-zinc-900">
                {workPrefsLabel || app.service_interests.join(", ") || "-"}
              </dd>
            </div>
            {skillLabels.length > 0 ? (
              <div>
                <dt className="font-medium text-zinc-500">Skills</dt>
                <dd className="text-zinc-900">{skillLabels.join(", ")}</dd>
              </div>
            ) : null}
            {typeof meta.worked_in_homes === "boolean" ? (
              <div>
                <dt className="font-medium text-zinc-500">Worked in homes</dt>
                <dd className="text-zinc-900">{meta.worked_in_homes ? "Yes" : "No"}</dd>
              </div>
            ) : null}
            {typeof meta.airbnb_experience === "boolean" ? (
              <div>
                <dt className="font-medium text-zinc-500">Airbnb experience</dt>
                <dd className="text-zinc-900">{meta.airbnb_experience ? "Yes" : "No"}</dd>
              </div>
            ) : null}
            {references.length > 0 ? (
              <div>
                <dt className="font-medium text-zinc-500">References</dt>
                <dd className="space-y-1 text-zinc-900">
                  {references.map((r) => (
                    <div key={`${r.name}-${r.phone}`}>
                      {r.name} · {r.phone}
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
            {app.notes ? (
              <div>
                <dt className="font-medium text-zinc-500">Applicant notes</dt>
                <dd className="whitespace-pre-wrap text-zinc-900">{app.notes}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-zinc-500">Submitted</dt>
              <dd className="text-zinc-900">
                <time dateTime={app.created_at}>
                  {new Date(app.created_at).toLocaleString("en-ZA")}
                </time>
              </dd>
            </div>
          </dl>

          <AdminCleanerApplicationActions
            applicationId={app.id}
            currentStatus={app.status}
            adminNotes={app.admin_notes}
            createdCleanerId={app.created_cleaner_id}
          />
        </div>
      </div>
    </AdminDashboardShell>
  );
}
