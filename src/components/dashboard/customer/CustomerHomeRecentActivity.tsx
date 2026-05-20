import Link from "next/link";
import type { CustomerHomeActivityItem } from "@/features/dashboards/customerHomeDisplay";
import {
  UI_CARD_SHELL_CLASS,
  UI_EMPTY_STATE_DESCRIPTION_CLASS,
  UI_SECTION_TITLE_CLASS,
} from "@/lib/ui/productUiTokens";

type Props = {
  items: CustomerHomeActivityItem[];
};

function formatActivityTime(at: string): string {
  try {
    return new Date(at).toLocaleString("en-ZA", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return at;
  }
}

export function CustomerHomeRecentActivity({ items }: Props) {
  return (
    <section className={`${UI_CARD_SHELL_CLASS} px-4 py-4 sm:px-5 sm:py-4`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={UI_SECTION_TITLE_CLASS}>Recent activity</h2>
        <Link
          href="/customer/bookings"
          className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          View all
        </Link>
      </div>

      {items.length === 0 ? (
        <p className={`mt-3 ${UI_EMPTY_STATE_DESCRIPTION_CLASS}`}>
          Activity from bookings and payments will show here.
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-zinc-100">
          {items.map((item) => (
            <li key={`${item.id}-${item.at}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zinc-300"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                {item.detail ? (
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{item.detail}</p>
                ) : null}
                <p className="mt-1 text-xs text-zinc-400">{formatActivityTime(item.at)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
