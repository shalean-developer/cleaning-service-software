import Link from "next/link";
import type { AdminCleanerApplicationListItem } from "@/features/cleaner-applications/server/adminCleanerApplicationsReadModel";

const STATUS_CLASS: Record<string, string> = {
  new: "bg-blue-50 text-blue-800",
  reviewing: "bg-amber-50 text-amber-900",
  approved: "bg-emerald-50 text-emerald-800",
  rejected: "bg-red-50 text-red-800",
  duplicate: "bg-slate-100 text-slate-700",
};

type Props = {
  items: AdminCleanerApplicationListItem[];
};

export function AdminCleanerApplicationsList({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
        No applications match this filter.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/admin/cleaner-applications/${item.id}`}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-zinc-50"
          >
            <div>
              <p className="font-medium text-zinc-900">{item.fullName}</p>
              <p className="text-sm text-zinc-500">
                {item.phone}
                {item.email ? ` · ${item.email}` : ""}
                {item.suburb ? ` · ${item.suburb}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_CLASS[item.status] ?? "bg-zinc-100"}`}
              >
                {item.status}
              </span>
              <time className="text-xs text-zinc-400" dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleDateString("en-ZA")}
              </time>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
