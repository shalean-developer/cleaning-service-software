type Variant = "list" | "detail";

type Props = {
  variant?: Variant;
  /** When true, includes a minimal shell header so layout does not jump. */
  showShell?: boolean;
};

function PulseBlock({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded-lg bg-zinc-200 ${className}`} aria-hidden />;
}

function ListSkeletonBody() {
  return (
    <>
      <PulseBlock className="h-10 w-full max-w-2xl" />
      <ul className="mt-6 space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i}>
            <section className="rounded-xl border border-zinc-200 bg-white p-4">
              <section className="flex gap-2">
                <PulseBlock className="h-5 w-20" />
                <PulseBlock className="h-5 w-16" />
              </section>
              <PulseBlock className="mt-3 h-4 w-3/5 max-w-xs" />
              <PulseBlock className="mt-2 h-3 w-2/5 max-w-[12rem]" />
            </section>
          </li>
        ))}
      </ul>
    </>
  );
}

function DetailSkeletonBody() {
  return (
    <>
      <PulseBlock className="h-4 w-28" />
      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <section className="flex gap-2">
          <PulseBlock className="h-5 w-24" />
          <PulseBlock className="h-5 w-20" />
        </section>
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <PulseBlock className="h-12 w-full" />
          <PulseBlock className="h-12 w-full" />
          <PulseBlock className="h-12 w-full" />
          <PulseBlock className="h-12 w-full" />
        </section>
      </section>
      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <PulseBlock className="h-4 w-24" />
        <PulseBlock className="mt-4 h-24 w-full" />
      </section>
    </>
  );
}

export function DashboardPageSkeleton({ variant = "list", showShell = true }: Props) {
  const body = variant === "detail" ? <DetailSkeletonBody /> : <ListSkeletonBody />;

  if (!showShell) {
    return (
      <section role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading dashboard…</span>
        {body}
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-zinc-50" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard…</span>
      <header className="border-b border-zinc-200 bg-white">
        <section className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <section className="space-y-2">
            <PulseBlock className="h-5 w-40" />
            <PulseBlock className="h-3 w-56" />
          </section>
          <section className="flex flex-wrap gap-2">
            <PulseBlock className="h-8 w-16" />
            <PulseBlock className="h-8 w-20" />
            <PulseBlock className="h-8 w-16" />
          </section>
        </section>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{body}</main>
    </section>
  );
}
