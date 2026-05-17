type Props = {
  title: string;
  description?: string;
};

/** Distinct from {@link EmptyState} — used when data failed to load, not when the list is empty. */
export function DashboardFetchError({ title, description }: Props) {
  return (
    <section
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center"
    >
      <h2 className="text-base font-medium text-red-900">{title}</h2>
      {description ? <p className="mt-2 text-sm text-red-800">{description}</p> : null}
    </section>
  );
}
