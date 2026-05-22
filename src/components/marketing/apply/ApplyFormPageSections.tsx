import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { MarketingContainer } from "@/components/marketing/MarketingContainer";
import {
  APPLY_FORM_PAGE_HEADER,
} from "@/features/marketing/apply-page-content";
import { CleanerApplyForm } from "./CleanerApplyForm";

type ApplyFormPageSectionsProps = {
  breadcrumbs?: ReactNode;
};

export function ApplyFormPageSections({ breadcrumbs }: ApplyFormPageSectionsProps) {
  return (
    <section className="bg-gradient-to-b from-slate-50 to-white pb-16 pt-8 sm:pb-20 sm:pt-10">
      <MarketingContainer>
        {breadcrumbs}

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[minmax(0,18rem)_minmax(0,42rem)] xl:justify-center">
          <aside className="lg:sticky lg:top-[calc(var(--marketing-header-height)+1.5rem)] lg:self-start">
            <Link
              href={APPLY_FORM_PAGE_HEADER.backHref}
              className="marketing-focus-ring inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-shalean-primary"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {APPLY_FORM_PAGE_HEADER.backLabel}
            </Link>
            <div className="mt-6 hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:block">
              <div className="flex gap-3">
                <Info className="h-5 w-5 shrink-0 text-shalean-primary" aria-hidden />
                <p className="text-sm leading-relaxed text-slate-600">
                  {APPLY_FORM_PAGE_HEADER.reviewNote}
                </p>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <header className="max-w-2xl">
              <h1 className="text-2xl font-semibold tracking-tight text-shalean-navy sm:text-3xl">
                {APPLY_FORM_PAGE_HEADER.title}
              </h1>
              <p className="mt-2 text-base text-slate-600">{APPLY_FORM_PAGE_HEADER.subtitle}</p>
            </header>
            <p className="mt-4 flex gap-2 rounded-xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600 lg:hidden">
              <Info className="h-5 w-5 shrink-0 text-shalean-primary" aria-hidden />
              {APPLY_FORM_PAGE_HEADER.reviewNote}
            </p>
            <div className="mt-8">
              <CleanerApplyForm />
            </div>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}
