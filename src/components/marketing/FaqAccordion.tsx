"use client";

import { useId, useState } from "react";
import { FAQ_ITEMS } from "@/features/marketing/constants";
import { IconChevron } from "./icons";
import { ClientOnly } from "./ClientOnly";

function panelId(baseId: string, index: number) {
  return `${baseId}-panel-${index}`;
}

function buttonId(baseId: string, index: number) {
  return `${baseId}-button-${index}`;
}

function FaqAccordionFallback({ baseId }: { baseId: string }) {
  return (
    <div className="mt-8 space-y-3">
      {FAQ_ITEMS.map((item, index) => (
        <details
          key={item.question}
          open={index === 0}
          className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]"
        >
          <summary className="cursor-pointer px-5 py-4 text-base font-semibold text-shalean-navy">
            {item.question}
          </summary>
          <p
            id={panelId(baseId, index)}
            className="border-t border-slate-100 px-5 pb-5 pt-3 text-sm leading-relaxed text-slate-600"
          >
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}

function FaqAccordionInteractive({ baseId }: { baseId: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mt-8 space-y-3">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;
        const btnId = buttonId(baseId, index);
        const pId = panelId(baseId, index);

        return (
          <div
            key={item.question}
            className={`overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow] duration-200 ${
              isOpen
                ? "border-shalean-primary/25 shadow-[0_6px_24px_rgba(37,99,235,0.08)]"
                : "border-slate-200/90 shadow-[0_2px_12px_rgba(15,23,42,0.03)] hover:border-slate-300/90 hover:shadow-[0_4px_20px_rgba(15,23,42,0.05)]"
            }`}
          >
            <button
              id={btnId}
              type="button"
              className="marketing-focus-ring flex w-full min-h-[3.25rem] items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold tracking-tight text-shalean-navy sm:px-6"
              aria-expanded={isOpen}
              aria-controls={pId}
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              {item.question}
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-shalean-soft-blue/60 text-shalean-primary transition-transform duration-300 ease-out ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                <IconChevron className="h-4 w-4" aria-hidden />
              </span>
            </button>
            <div
              id={pId}
              role="region"
              aria-labelledby={btnId}
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="border-t border-slate-100 px-5 pb-5 pt-3 text-sm leading-relaxed text-slate-600 sm:px-6 sm:pb-6">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FaqAccordion() {
  const baseId = useId().replace(/:/g, "");

  return (
    <ClientOnly fallback={<FaqAccordionFallback baseId={baseId} />}>
      <FaqAccordionInteractive baseId={baseId} />
    </ClientOnly>
  );
}
