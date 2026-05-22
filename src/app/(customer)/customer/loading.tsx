import { CustomerHubShell } from "@/components/dashboard/customer/CustomerHubShell";

export default function CustomerHomeLoading() {
  return (
    <CustomerHubShell accountLabel="Loading…" showLiveBadge={false}>
      <div className="mx-auto max-w-4xl animate-pulse space-y-5">
        <div className="h-24 rounded-2xl bg-zinc-200/60" />
        <div className="h-56 rounded-2xl bg-blue-100/50" />
        <div className="h-32 rounded-2xl bg-zinc-200/50" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-200/50" />
          ))}
        </div>
      </div>
    </CustomerHubShell>
  );
}
