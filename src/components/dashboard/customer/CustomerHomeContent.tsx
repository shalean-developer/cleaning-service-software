import Link from "next/link";
import { CustomerBookACleanCta } from "@/components/dashboard/customer/CustomerBookACleanCta";
import { UI_BUTTON_SECONDARY_CLASS } from "@/lib/ui/productUiTokens";

export function CustomerHomeContent() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <header className="max-w-xl">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Welcome back
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 sm:text-[0.9375rem]">
          Book a clean, track payments, and see when your cleaner is assigned — all from
          your bookings page.
        </p>
      </header>

      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <CustomerBookACleanCta />
        <Link href="/customer/bookings" className={UI_BUTTON_SECONDARY_CLASS}>
          My bookings
        </Link>
      </section>
    </section>
  );
}
