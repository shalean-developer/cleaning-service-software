type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: Props) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h2 className="text-base font-medium text-zinc-900">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{description}</p>
      ) : null}
      {action ? <section className="mt-6 flex justify-center">{action}</section> : null}
    </section>
  );
}
