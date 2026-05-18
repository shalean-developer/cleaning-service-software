function InboxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

type Props = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function CustomerBookingsEmptyState({ title, description, action }: Props) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white px-6 py-12 text-center shadow-sm sm:px-10 sm:py-14">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-400 ring-1 ring-zinc-200/60">
        <InboxIcon className="h-7 w-7" />
      </span>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-zinc-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">{description}</p>
      {action ? <section className="mt-6 flex justify-center">{action}</section> : null}
    </section>
  );
}
