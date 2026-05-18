function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function CustomerBookingsPageHeader() {
  return (
    <header className="flex gap-3.5 sm:gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm sm:h-12 sm:w-12">
        <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">My Bookings</h1>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-500 sm:text-[0.9375rem]">
          Track your upcoming, active, and completed cleaning services.
        </p>
      </section>
    </header>
  );
}
