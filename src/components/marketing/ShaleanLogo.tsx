"use client";

import Image from "next/image";
import Link from "next/link";
import { MARKETING_IMAGES } from "@/features/marketing/constants";

type ShaleanLogoProps = {
  variant?: "header" | "footer";
};

const LOGO_WIDTH = 709;
const LOGO_HEIGHT = 204;

/** Shared width for both lines — ghost row sizes the grid; top line is justified to match. */
function LogoWordmark({ variant }: { variant: "footer" }) {
  const bottomSize = "text-[10px]";
  const topSize = "text-sm";
  const topColor = "text-white";
  const bottomColor = "text-slate-400";

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
  if (variant === "header") {
    return (
      <Link
        href="/"
        className="group flex shrink-0 items-center"
        aria-label="Shalean Cleaning Services home"
      >
        <Image
          src={MARKETING_IMAGES.logo}
          alt={MARKETING_IMAGES.logoAlt}
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          unoptimized
          className="h-9 w-auto sm:h-10"
          priority
        />
      </Link>
    );
  }

  return (
    <Link
      href="/"
      className="group flex items-center gap-2 sm:gap-2.5"
      aria-label="Shalean Cleaning Services home"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-shalean-primary text-white shadow-[0_4px_20px_rgba(37,99,235,0.35)] ring-1 ring-white/10">
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current sm:h-7 sm:w-7" aria-hidden>
          <path d="M12 2l2.4 6.4H21l-5.2 3.8 2 6.2L12 16l-5.8 4.4 2-6.2L3 8.4h6.6L12 2z" />
        </svg>
      </span>
      <LogoWordmark variant="footer" />
    </Link>
  );
}
