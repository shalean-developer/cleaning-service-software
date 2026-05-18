type Props = {
  title: string;
  description?: string;
};

/** Distinct from {@link EmptyState} — used when data failed to load, not when the list is empty. */
export function DashboardFetchError({ title, description }: Props) {
  return (
    <section
      role="alert"
      className="rounded-2xl border border-zinc-200 bg-zinc-50/90 px-6 py-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <h2 className="text-base font-medium text-zinc-900">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{description}</p>
      ) : null}
    </section>
  );
}
