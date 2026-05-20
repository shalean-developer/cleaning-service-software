import { CleanerProfileMenu } from "@/components/dashboard/cleaner/CleanerProfileMenu";
import type { CleanerProfileMenuProps } from "@/components/dashboard/cleaner/CleanerProfileMenu";

type Props = CleanerProfileMenuProps;

/** Optional cleaner dashboard header actions (notifications placeholder + profile menu). */
export function CleanerDashboardHeaderEnd(props: Props) {
  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
      <button
        type="button"
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        aria-label="Notifications (coming soon)"
        disabled
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0m6 0H9"
          />
        </svg>
      </button>
      <CleanerProfileMenu {...props} />
    </div>
  );
}
