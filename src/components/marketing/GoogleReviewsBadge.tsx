import { SHALEAN_CONTACT } from "@/features/marketing/constants";
import { IconStar } from "./icons";

type GoogleReviewsBadgeProps = {
  className?: string;
  ratingText?: string;
};

export function GoogleReviewsBadge({
  className = "",
  ratingText = "4.9/5 from 1,200+ Google reviews",
}: GoogleReviewsBadgeProps) {
  return (
    <a
      href={SHALEAN_CONTACT.googleReviewsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`marketing-focus-ring inline-flex flex-wrap items-center gap-2.5 rounded-xl border border-transparent px-2 py-1 transition hover:border-shalean-border/60 hover:bg-white/80 ${className}`.trim()}
      aria-label={`${ratingText}. Opens Google reviews in a new tab`}
    >
      <span className="flex text-amber-400" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <IconStar key={i} className="h-5 w-5" />
        ))}
      </span>
      <span className="text-sm font-semibold text-shalean-navy">{ratingText}</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-blue-600 shadow-sm ring-1 ring-shalean-border">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Google
      </span>
    </a>
  );
}
