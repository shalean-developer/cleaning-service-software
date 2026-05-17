import Link from "next/link";
import type { NotificationHealthFilters } from "@/features/notifications/server/notificationAdminTypes";

type Props = {
  filters: NotificationHealthFilters;
};

function buildHref(overrides: Partial<{
  status: string;
  deliverable: string;
  template: string | null;
}>): string {
  const params = new URLSearchParams();
  if (overrides.status) params.set("status", overrides.status);
  if (overrides.deliverable) params.set("deliverable", overrides.deliverable);
  if (overrides.template) params.set("template", overrides.template);
  const q = params.toString();
  return q ? `/admin/notifications?${q}` : "/admin/notifications";
}

function chipClass(active: boolean): string {
  return active
    ? "rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white"
    : "rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50";
}

export function AdminNotificationFilters({ filters }: Props) {
  const statusKey = filters.status.join(",");
  const deliverable = filters.deliverable;

  return (
    <section className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs font-medium text-zinc-500">Presets:</span>
      <Link
        href={buildHref({
          status: "pending,processing,failed",
          deliverable: "true",
        })}
        className={chipClass(
          deliverable === "true" && statusKey === "pending,processing,failed",
        )}
      >
        Needs attention
      </Link>
      <Link
        href={buildHref({ status: "failed", deliverable: "true" })}
        className={chipClass(deliverable === "true" && statusKey === "failed")}
      >
        Failed only
      </Link>
      <Link
        href={buildHref({ status: "pending", deliverable: "false" })}
        className={chipClass(deliverable === "false")}
      >
        Unsupported backlog
      </Link>
      <Link
        href={buildHref({ status: "sent,pending,processing,failed", deliverable: "all" })}
        className={chipClass(deliverable === "all")}
      >
        Show all
      </Link>

      <form method="get" className="ml-auto flex flex-wrap items-end gap-2">
        <label className="text-xs text-zinc-600">
          Status
          <select
            name="status"
            defaultValue={statusKey}
            className="mt-1 block rounded border border-zinc-200 px-2 py-1 text-xs"
          >
            <option value="pending,processing,failed">Needs attention</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="sent">Sent</option>
            <option value="pending,processing,failed,sent">All statuses</option>
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Deliverable
          <select
            name="deliverable"
            defaultValue={deliverable}
            className="mt-1 block rounded border border-zinc-200 px-2 py-1 text-xs"
          >
            <option value="true">Deliverable only</option>
            <option value="false">Unsupported only</option>
            <option value="all">All templates</option>
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Template
          <input
            name="template"
            type="text"
            defaultValue={filters.template ?? ""}
            placeholder="e.g. payment_confirmed"
            className="mt-1 block w-40 rounded border border-zinc-200 px-2 py-1 font-mono text-xs"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Apply
        </button>
      </form>
    </section>
  );
}
