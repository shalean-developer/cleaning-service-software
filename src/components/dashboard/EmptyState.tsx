type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: Props) {
  return (
    <section className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-12 text-center">
      <h2 className="text-base font-medium text-zinc-900">{title}</h2>
      {description ? <p className="mt-2 text-sm text-zinc-600">{description}</p> : null}
      {action ? <section className="mt-6 flex justify-center">{action}</section> : null}
    </section>
  );
}
