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

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const MAX_NAME_CHARS = 48;
const MAX_INLINE_CHARS = 56;

export function formatCleanerDisplayName(name: string): { display: string; full: string } {
  const full = name.trim();
  const uuidMatch = full.match(UUID_RE);
  if (uuidMatch && full.length > 32) {
    const uuid = uuidMatch[0];
    const prefix = full.slice(0, full.indexOf(uuid)).trim();
    const shortId = uuid.length > 10 ? `${uuid.slice(0, 8)}…` : uuid;
    const display = prefix ? `${prefix} ${shortId}` : shortId;
    return { display, full };
  }
  if (full.length > MAX_NAME_CHARS) {
    return { display: `${full.slice(0, MAX_NAME_CHARS - 1)}…`, full };
  }
  return { display: full, full };
}

export function truncateCleanerCellText(value: string, maxChars = MAX_INLINE_CHARS): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1)}…`;
}

function formatLastAction(item: AdminCleanerListItem): string | null {
  if (!item.lastLifecycleAction) return null;
  const { action, outcome } = item.lastLifecycleAction;
  return `${labelForCleanerLifecycleAuditAction(action)} (${outcome})`;
}

function TruncatedText({
  value,
  className = "",
  title,
}: {
  value: string;
  className?: string;
  title?: string;
}) {
  const full = title ?? value;
  return (
    <span className={`block truncate ${className}`} title={full}>
      {value}
    </span>
  );
}

export function AdminCleanerListTable({ items }: Props) {
  return (
    <>
      <div className="mt-4 hidden overflow-hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[20%]" />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">State</th>
              <th className="px-2 py-2 text-center">Active</th>
              <th className="px-2 py-2 text-center">Suspended</th>
              <th className="px-2 py-2 text-right">Open offers</th>
              <th className="px-2 py-2 text-right">Active bookings</th>
              <th className="px-2 py-2 text-right">Pending earnings</th>
              <th className="px-3 py-2">Last action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const { display: nameDisplay, full: nameFull } = formatCleanerDisplayName(item.name);
              const lastAction = formatLastAction(item);

              return (
                <tr
                  key={item.id}
                  className="border-b border-zinc-100 align-middle hover:bg-zinc-50/80"
                >
                  <td className="max-w-0 px-3 py-2">
                    <Link
                      href={`/admin/cleaners/${item.id}`}
                      className="block truncate font-medium text-zinc-900 underline-offset-2 hover:underline"
                      title={nameFull}
                    >
                      {nameDisplay}
                    </Link>
                  </td>
                  <td className="max-w-0 px-3 py-2 text-zinc-600">
                    {item.email ? (
                      <TruncatedText
                        value={truncateCleanerCellText(item.email)}
                        title={item.email}
                        className="text-zinc-600"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-0 px-3 py-2 text-zinc-600">
                    {item.phone ? (
                      <TruncatedText
                        value={truncateCleanerCellText(item.phone)}
                        title={item.phone}
                        className="whitespace-nowrap text-zinc-600"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex max-w-full [&_span]:whitespace-nowrap [&_span]:[overflow-wrap:normal]">
                      <StatusBadge
                        label={labelForCleanerOperationalState(item.operationalState)}
                        tone={toneForCleanerOperationalState(item.operationalState)}
                        variant="soft"
                      />
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-center text-zinc-700">
                    {item.active ? "Yes" : "No"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-center text-zinc-700">
                    {item.isSuspended ? "Yes" : "No"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {item.openOffersCount}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {item.activeBookingsCount}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {item.pendingEarningsCount}
                  </td>
                  <td className="max-w-0 px-3 py-2 text-xs text-zinc-500">
                    {lastAction ? (
                      <TruncatedText
                        value={truncateCleanerCellText(lastAction, 40)}
                        title={lastAction}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 space-y-2.5 md:hidden">
        {items.map((item) => {
          const { display: nameDisplay, full: nameFull } = formatCleanerDisplayName(item.name);
          const contact = item.email ?? item.phone ?? "—";
          const contactTitle = item.email ?? item.phone ?? undefined;

          return (
            <li key={item.id}>
              <Link href={`/admin/cleaners/${item.id}`} className={ADMIN_LIST_CARD_CLASS}>
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900" title={nameFull}>
                      {nameDisplay}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500" title={contactTitle}>
                      {truncateCleanerCellText(contact)}
                    </p>
                  </div>
                  <span className="shrink-0 [&_span]:whitespace-nowrap [&_span]:[overflow-wrap:normal]">
                    <StatusBadge
                      label={labelForCleanerOperationalState(item.operationalState)}
                      tone={toneForCleanerOperationalState(item.operationalState)}
                      variant="soft"
                    />
                  </span>
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
          );
        })}
      </ul>
    </>
  );
}

