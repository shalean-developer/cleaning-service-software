"use client";

import { useId, useState } from "react";

type DetailsFieldInfoProps = {
  text: string;
};

/** Compact info control — hover on desktop, tap/focus on mobile. Presentation only. */
export function DetailsFieldInfo({ text }: DetailsFieldInfoProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex shrink-0 align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-400"
        aria-expanded={open}
        aria-controls={tooltipId}
        aria-label="More information"
        aria-describedby={tooltipId}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 7.25v4" strokeLinecap="round" />
          <circle cx="8" cy="5.1" r="0.75" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-zinc-200/90 bg-white px-2.5 py-2 text-[11px] leading-snug text-zinc-600 shadow-md transition-opacity duration-150 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        {text}
      </span>
    </span>
  );
}

type DetailsLabelWithInfoProps = {
  id?: string;
  label: string;
  infoText: string;
  className?: string;
};

export function DetailsLabelWithInfo({
  id,
  label,
  infoText,
  className = "mb-1.5 flex items-center gap-1.5",
}: DetailsLabelWithInfoProps) {
  return (
    <div className={className}>
      <span id={id} className="text-sm font-medium text-zinc-800">
        {label}
      </span>
      <DetailsFieldInfo text={infoText} />
    </div>
  );
}
