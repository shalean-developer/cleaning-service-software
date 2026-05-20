"use client";

import { useState } from "react";
import { FAQ_ITEMS } from "@/features/marketing/constants";
import { IconChevron } from "./icons";
import { ClientOnly } from "./ClientOnly";

function FaqAccordionFallback() {
  return (
    <div className="mt-4 space-y-1.5">
      {FAQ_ITEMS.map((item, index) => (
        <details
          key={item.question}
          open={index === 0}
          className="overflow-hidden rounded-xl border border-shalean-border bg-shalean-surface/50"
        >
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-shalean-navy">
            {item.question}
          </summary>
          <p className="border-t border-shalean-border px-4 pb-3 pt-1.5 text-sm leading-relaxed text-slate-600">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}

function FaqAccordionInteractive() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mt-4 space-y-1.5">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={item.question}
            className="overflow-hidden rounded-xl border border-shalean-border bg-shalean-surface/50"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-shalean-navy hover:bg-shalean-soft-blue/30"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              {item.question}
              <IconChevron
                className={`h-4 w-4 shrink-0 text-shalean-primary transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen ? (
              <div className="border-t border-shalean-border px-4 pb-3 pt-1.5">
                <p className="text-sm leading-relaxed text-slate-600">{item.answer}</p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function FaqAccordion() {
  return (
    <ClientOnly fallback={<FaqAccordionFallback />}>
      <FaqAccordionInteractive />
    </ClientOnly>
  );
}
