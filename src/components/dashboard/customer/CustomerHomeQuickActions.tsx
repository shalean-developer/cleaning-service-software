import Link from "next/link";
import { CUSTOMER_HOME_QUICK_ACTIONS } from "@/features/dashboards/customerHomeDisplay";
import { UI_CARD_SHELL_CLASS, UI_SECTION_TITLE_CLASS } from "@/lib/ui/productUiTokens";

export function CustomerHomeQuickActions() {
  return (
    <section>
      <h2 className={UI_SECTION_TITLE_CLASS}>Quick actions</h2>
      <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {CUSTOMER_HOME_QUICK_ACTIONS.map((action) => (
          <li key={action.slug}>
            <Link
              href={action.href}
              className={`${UI_CARD_SHELL_CLASS} flex min-h-[5.5rem] flex-col justify-between px-3 py-3 transition-[border-color,background-color] hover:border-zinc-300 hover:bg-zinc-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 sm:min-h-[6rem] sm:px-3.5 sm:py-3.5`}
            >
              <span className="text-sm font-semibold text-zinc-900">{action.label}</span>
              <span className="mt-1 text-xs leading-snug text-zinc-500">{action.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
