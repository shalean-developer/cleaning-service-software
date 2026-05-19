import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
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

/** Matches the former table column proportions (Name / Email / Phone / State / Active). */
const CLEANER_LIST_ROW_GRID_CLASS =
  "grid w-full grid-cols-[minmax(0,28fr)_minmax(0,30fr)_minmax(0,18fr)_minmax(0,14fr)_minmax(0,10fr)] items-center text-sm";

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

function CleanerListRowCells({ item }: { item: AdminCleanerListItem }) {
  const { display: nameDisplay, full: nameFull } = formatCleanerDisplayName(item.name);

  return (
    <>
      <div className="min-w-0 px-3">
        <span className="block truncate font-medium text-zinc-900" title={nameFull}>
          {nameDisplay}
        </span>
      </div>
      <div className="min-w-0 px-3 text-zinc-600">
        {item.email ? (
          <TruncatedText
            value={truncateCleanerCellText(item.email)}
            title={item.email}
            className="text-zinc-600"
          />
        ) : (
          "—"
        )}
      </div>
      <div className="min-w-0 px-3 text-zinc-600">
        {item.phone ? (
          <TruncatedText
            value={truncateCleanerCellText(item.phone)}
            title={item.phone}
            className="whitespace-nowrap text-zinc-600"
          />
        ) : (
          "—"
        )}
      </div>
      <div className="min-w-0 px-3">
        <span className="inline-flex max-w-full [&_span]:whitespace-nowrap [&_span]:[overflow-wrap:normal]">
          <StatusBadge
            label={labelForCleanerOperationalState(item.operationalState)}
            tone={toneForCleanerOperationalState(item.operationalState)}
            variant="soft"
          />
        </span>
      </div>
      <div className="whitespace-nowrap px-2 text-center text-zinc-700">
        {item.active ? "Yes" : "No"}
      </div>
    </>
  );
}

export function AdminCleanerListTable({ items }: Props) {
  return (
    <div className="mt-4 overflow-hidden">
      <div
        className={`${CLEANER_LIST_ROW_GRID_CLASS} border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500`}
      >
        <div className="px-3 py-2">Name</div>
        <div className="px-3 py-2">Email</div>
        <div className="px-3 py-2">Phone</div>
        <div className="px-3 py-2">State</div>
        <div className="px-2 py-2 text-center">Active</div>
      </div>

      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/admin/cleaners/${item.id}`}
              className={`${ADMIN_LIST_CARD_CLASS} ${CLEANER_LIST_ROW_GRID_CLASS} py-2.5 sm:py-3`}
            >
              <CleanerListRowCells item={item} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
