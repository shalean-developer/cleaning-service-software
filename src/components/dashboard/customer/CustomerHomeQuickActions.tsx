import Link from "next/link";

type QuickAction = {
  label: string;
  href: string;
  icon: "calendar" | "message" | "refresh" | "cancel";
};

type Props = {
  actions: QuickAction[];
};

function QuickActionIcon({ icon }: { icon: QuickAction["icon"] }) {
  const className = "h-5 w-5 text-zinc-500";
  switch (icon) {
    case "calendar":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" d="M8 3v2m8-2v2M4 9h16M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        </svg>
      );
    case "message":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z" />
        </svg>
      );
    case "refresh":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" d="M4 12a8 8 0 0 1 13.3-5.7M20 6v4h-4M20 12a8 8 0 0 1-13.3 5.7M4 18v-4h4" />
        </svg>
      );
    case "cancel":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M8 8l8 8M16 8l-8 8" />
        </svg>
      );
    default:
      return null;
  }
}

export function CustomerHomeQuickActions({ actions }: Props) {
  return (
    <section>
      <h2 className="font-serif text-xl font-medium text-shalean-navy">Quick actions</h2>
      <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {actions.map((action) => (
          <li key={action.label}>
            <Link
              href={action.href}
              className="flex min-h-[5.25rem] flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white px-3.5 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[border-color,box-shadow] hover:border-zinc-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shalean-primary focus-visible:ring-offset-2 sm:min-h-[5.75rem]"
            >
              <QuickActionIcon icon={action.icon} />
              <span className="text-sm font-medium text-zinc-800">{action.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
