import Link from "next/link";

type ShaleanLogoProps = {
  variant?: "header" | "footer";
};

/** Shared width for both lines — ghost row sizes the grid; top line is justified to match. */
function LogoWordmark({ variant }: { variant: "header" | "footer" }) {
  const isFooter = variant === "footer";

  const bottomSize = isFooter ? "text-[10px]" : "text-[8px] sm:text-[9px]";
  const topSize = isFooter ? "text-sm" : "text-xs sm:text-[13px]";
  const topColor = isFooter ? "text-white" : "text-shalean-navy";
  const bottomColor = isFooter ? "text-slate-400" : "text-shalean-navy/70";

  return (
    <span className="inline-grid grid-cols-1 leading-tight">
      <span
        className={`invisible col-start-1 row-start-1 whitespace-nowrap font-medium tracking-wide ${bottomSize}`}
        aria-hidden
      >
        CLEANING SERVICES
      </span>
      <span
        className={`col-start-1 row-start-1 w-full text-justify font-extrabold tracking-tight [text-align-last:justify] ${topSize} ${topColor}`}
      >
        SHALEAN
      </span>
      <span
        className={`col-start-1 row-start-2 font-medium tracking-wide ${bottomSize} ${bottomColor}`}
      >
        CLEANING SERVICES
      </span>
    </span>
  );
}

export function ShaleanLogo({ variant = "header" }: ShaleanLogoProps) {
  const isFooter = variant === "footer";

  return (
    <Link
      href="/"
      className={`group flex items-center ${
        isFooter ? "gap-2 sm:gap-2.5" : "gap-2.5 sm:gap-3"
      }`}
      aria-label="Shalean Cleaning Services home"
    >
      <span
        className={`flex shrink-0 items-center justify-center ${
          isFooter
            ? "h-11 w-11 rounded-xl bg-shalean-primary text-white shadow-[0_4px_20px_rgba(37,99,235,0.35)] ring-1 ring-white/10"
            : "h-8 w-8 text-shalean-primary sm:h-9 sm:w-9"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current sm:h-7 sm:w-7" aria-hidden>
          <path d="M12 2l2.4 6.4H21l-5.2 3.8 2 6.2L12 16l-5.8 4.4 2-6.2L3 8.4h6.6L12 2z" />
        </svg>
      </span>
      <LogoWordmark variant={variant} />
    </Link>
  );
}
