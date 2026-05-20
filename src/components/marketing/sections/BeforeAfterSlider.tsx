"use client";

import Image from "next/image";
import { useCallback, useRef, useState, type PointerEvent } from "react";
import { MARKETING_IMAGES } from "@/features/marketing/constants";

type BeforeAfterSliderProps = {
  className?: string;
  fillHeight?: boolean;
};

function SliderHandle() {
  return (
    <span
      className="pointer-events-none flex h-12 w-12 items-center justify-center rounded-full border border-white/90 bg-white/95 text-shalean-primary shadow-[0_4px_20px_rgba(15,23,42,0.12)] backdrop-blur-sm ring-1 ring-slate-200/80"
      aria-hidden
    >
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 5l-3 5 3 5M13 5l3 5-3 5" />
      </svg>
    </span>
  );
}

export function BeforeAfterSlider({ className = "", fillHeight = false }: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(52);
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const next = Math.min(95, Math.max(5, ratio * 100));
    setPosition(next);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    frameRef.current?.setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromClientX(event.clientX);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    frameRef.current?.releasePointerCapture(event.pointerId);
  };

  return (
    <figure
      className={`before-after-slider group relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.06)] ${fillHeight ? "flex h-full min-h-0 flex-col" : ""} ${className}`.trim()}
    >
      <div
        ref={frameRef}
        className={`relative w-full cursor-ew-resize select-none touch-none aspect-[5/3] sm:aspect-[16/10] ${fillHeight ? "lg:aspect-auto lg:min-h-[26rem] lg:flex-1" : "max-w-[45rem]"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Image
          src={MARKETING_IMAGES.beforeAfterAfter}
          alt="Bright, premium living space after professional Shalean cleaning"
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          priority
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <Image
            src={MARKETING_IMAGES.beforeAfterBefore}
            alt="Kitchen before professional Shalean cleaning"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        </div>

        <div
          className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-gradient-to-b from-transparent via-white to-transparent shadow-[0_0_12px_rgba(255,255,255,0.65)]"
          style={{ left: `${position}%`, transform: "translateX(-50%)" }}
          aria-hidden
        />

        <div
          className="pointer-events-none absolute z-20 flex -translate-x-1/2 flex-col items-center justify-center"
          style={{ left: `${position}%`, top: "50%", transform: "translate(-50%, -50%)" }}
          aria-hidden
        >
          <SliderHandle />
        </div>

        <span className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-white/60 bg-white/90 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-shalean-navy shadow-sm backdrop-blur-md">
          Before
        </span>
        <span className="pointer-events-none absolute right-4 top-4 z-20 rounded-full bg-shalean-primary px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white shadow-[0_2px_12px_rgba(37,99,235,0.35)]">
          After
        </span>
      </div>

      <figcaption className="sr-only">
        Interactive before and after comparison of a home cleaned by Shalean
      </figcaption>

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
        className="absolute inset-x-0 bottom-0 z-30 h-full w-full cursor-ew-resize opacity-0"
        aria-valuemin={5}
        aria-valuemax={95}
        aria-valuenow={position}
        aria-valuetext={`${Math.round(position)} percent before, ${Math.round(100 - position)} percent after`}
      />
    </figure>
  );
}
