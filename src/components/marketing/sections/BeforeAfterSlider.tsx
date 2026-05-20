"use client";

import Image from "next/image";
import { useState } from "react";
import { MARKETING_IMAGES } from "@/features/marketing/constants";

type BeforeAfterSliderProps = {
  className?: string;
  fillHeight?: boolean;
};

export function BeforeAfterSlider({ className = "", fillHeight = false }: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-shalean-border marketing-card-shadow ${fillHeight ? "flex h-full min-h-0 flex-col" : ""} ${className}`.trim()}
    >
      <div
        className={`relative w-full aspect-[720/420] max-w-[45rem] ${fillHeight ? "lg:aspect-auto lg:max-w-none lg:h-full lg:min-h-0 lg:flex-1" : ""}`}
      >
        <Image
          src={MARKETING_IMAGES.beforeAfterAfter}
          alt="Bright, sparkling clean kitchen after professional Shalean cleaning"
          fill
          sizes="(max-width: 768px) 100vw, 60vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <Image
            src={MARKETING_IMAGES.beforeAfterBefore}
            alt="Cluttered kitchen before professional cleaning"
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover"
          />
        </div>
        <div
          className="absolute bottom-0 top-0 z-10 flex w-1 flex-col items-center justify-center bg-white shadow-lg"
          style={{ left: `${position}%`, transform: "translateX(-50%)" }}
          aria-hidden
        >
          <span className="absolute flex h-10 w-10 items-center justify-center rounded-full bg-white text-shalean-primary shadow-md ring-2 ring-shalean-border">
            ↔
          </span>
        </div>
        <span className="absolute left-4 top-4 rounded-full bg-shalean-navy/85 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
          Before
        </span>
        <span className="absolute right-4 top-4 rounded-full bg-shalean-primary px-4 py-1.5 text-xs font-semibold text-white">
          After
        </span>
      </div>
      <label className="sr-only" htmlFor="before-after-range">
        Drag to compare before and after cleaning
      </label>
      <input
        id="before-after-range"
        type="range"
        min={5}
        max={95}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        className="absolute inset-x-6 bottom-5 z-20 w-[calc(100%-3rem)] accent-shalean-primary"
      />
    </div>
  );
}
