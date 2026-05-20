import Link from "next/link";
import { customerBookServicePath } from "@/features/booking-wizard/bookServiceRoute";
import { UI_CARD_SHELL_SOFT_BORDER_CLASS } from "@/lib/ui/productUiTokens";

/** Subtle recurring / rebook prompt when the customer has history but nothing upcoming. */
export function CustomerHomeRecurringCta() {
  return (
    <section
      className={`${UI_CARD_SHELL_SOFT_BORDER_CLASS} flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900">Keep your home consistently clean</p>
        <p className="mt-0.5 text-sm text-zinc-600">
          Book monthly recurring cleaning or rebook your last service in one tap.
        </p>
      </div>
      <Link
        href={customerBookServicePath("regular-cleaning")}
        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
      >
        Book again
      </Link>
    </section>
  );
}
