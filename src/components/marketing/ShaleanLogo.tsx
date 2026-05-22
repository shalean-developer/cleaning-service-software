"use client";

import Image from "next/image";
import Link from "next/link";
import { MARKETING_IMAGES } from "@/features/marketing/constants";

type ShaleanLogoProps = {
  variant?: "header" | "footer";
};

const LOGO_WIDTH = 709;
const LOGO_HEIGHT = 204;

const LOGO_SIZE_CLASS = {
  header: "h-9 w-auto sm:h-10",
  footer: "h-9 w-auto sm:h-10",
} as const;

export function ShaleanLogo({ variant = "header" }: ShaleanLogoProps) {
  return (
    <Link
      href="/"
      className="group inline-flex shrink-0 items-center"
      aria-label="Shalean Cleaning Services home"
    >
      <Image
        src={MARKETING_IMAGES.logo}
        alt={MARKETING_IMAGES.logoAlt}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        unoptimized
        className={LOGO_SIZE_CLASS[variant]}
        priority={variant === "header"}
      />
    </Link>
  );
}
