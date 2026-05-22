import Link from "next/link";
import type { CleanerOnboardingLeadItem } from "@/features/cleaners/server/admin/loadCleanerOnboardingLeads";
import { buildAdminCreateCleanerHref } from "@/features/cleaners/server/admin/loadCleanerOnboardingLeads";
import { formatZaMobileForDisplay } from "@/lib/validation/zaPhone";

const STATUS_CLASS: Record<string, string> = {
  needs_auth_invite: "bg-amber-50 text-amber-900",
};

type Props = {
  leads: CleanerOnboardingLeadItem[];
};

export function AdminCleanerOnboardingLeadsTable({ leads }: Props) {
  if (leads.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
        No onboarding leads with status needs_auth_invite.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-100 text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
          <tr>
            <th scope="col" className="px-4 py-3">
              Full name
            </th>
            <th scope="col" className="px-4 py-3">
              Phone
            </th>
            <th scope="col" className="px-4 py-3">
              Suggested login email
            </th>
            <th scope="col" className="px-4 py-3">
              Status
            </th>
            <th scope="col" className="px-4 py-3">
              Notes
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {leads.map((lead) => {
            const phoneDisplay = formatZaMobileForDisplay(lead.phone) ?? lead.phone;
            const createHref = buildAdminCreateCleanerHref(lead);
            return (
              <tr key={`${lead.sourceCsvRow}-${lead.phone}`} className="align-top">
                <td className="px-4 py-3 font-medium text-zinc-900">{lead.fullName}</td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700">
                  <span title={lead.phone}>{phoneDisplay}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                  {lead.adminLoginEmail || "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[lead.status] ?? "bg-zinc-100 text-zinc-700"}`}
                  >
                    {lead.status.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3 text-xs text-zinc-500">{lead.notes}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={createHref}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                  >
                    Create cleaner
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
