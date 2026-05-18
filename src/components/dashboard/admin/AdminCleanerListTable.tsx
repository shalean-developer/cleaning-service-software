import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  labelForCleanerLifecycleAuditAction,
  labelForCleanerOperationalState,
  toneForCleanerOperationalState,
} from "@/features/cleaners/server/admin/adminCleanerOperationalDisplay";
import type { AdminCleanerListItem } from "@/features/cleaners/server/admin/types";
import { ADMIN_LIST_CARD_CLASS } from "@/features/dashboards/adminDisplay";

type Props = {
  items: AdminCleanerListItem[];
};

function formatLastAction(item: AdminCleanerListItem): string | null {
  if (!item.lastLifecycleAction) return null;
  const { action, outcome } = item.lastLifecycleAction;
  return `${labelForCleanerLifecycleAuditAction(action)} (${outcome})`;
}

export function AdminCleanerListTable({ items }: Props) {
  return (
    <>
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Suspended</th>
              <th className="px-3 py-2 text-right">Open offers</th>
              <th className="px-3 py-2 text-right">Active bookings</th>
              <th className="px-3 py-2 text-right">Pending earnings</th>
              <th className="px-3 py-2">Last action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50/80">
                <td className="px-3 py-2.5">
                  <Link
                    href={`/admin/cleaners/${item.id}`}
                    className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                  >
                    {item.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-zinc-600">{item.email ?? "—"}</td>
                <td className="px-3 py-2.5 text-zinc-600">{item.phone ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge
                    label={labelForCleanerOperationalState(item.operationalState)}
                    tone={toneForCleanerOperationalState(item.operationalState)}
                    variant="soft"
                  />
                </td>
                <td className="px-3 py-2.5 text-zinc-700">{item.active ? "Yes" : "No"}</td>
                <td className="px-3 py-2.5 text-zinc-700">{item.isSuspended ? "Yes" : "No"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{item.openOffersCount}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{item.activeBookingsCount}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {item.pendingEarningsCount}
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-500">
                  {formatLastAction(item) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 space-y-2.5 md:hidden">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/admin/cleaners/${item.id}`} className={ADMIN_LIST_CARD_CLASS}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">{item.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{item.email ?? item.phone ?? "—"}</p>
                </div>
                <StatusBadge
                  label={labelForCleanerOperationalState(item.operationalState)}
                  tone={toneForCleanerOperationalState(item.operationalState)}
                  variant="soft"
                />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-600">
                <div>
                  <dt className="text-zinc-400">Offers</dt>
                  <dd className="font-medium tabular-nums text-zinc-800">
                    {item.openOffersCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Bookings</dt>
                  <dd className="font-medium tabular-nums text-zinc-800">
                    {item.activeBookingsCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Earnings</dt>
                  <dd className="font-medium tabular-nums text-zinc-800">
                    {item.pendingEarningsCount}
                  </dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
