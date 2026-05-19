import { DASHBOARD_LOADING_SR_LABEL } from "@/lib/app/dashboardEcosystemDisplay";
import {
  UI_LIST_STACK_CLASS,
  UI_PAGE_SECTION_GAP_CLASS,
  UI_SKELETON_LIST_CARD_CLASS,
  UI_SKELETON_PULSE_CLASS,
} from "@/lib/ui/productUiTokens";

type Variant = "list" | "detail";

type Props = {
  variant?: Variant;
  /** When true, includes a minimal shell header so layout does not jump. */
  showShell?: boolean;
};

function PulseBlock({ className }: { className: string }) {
  return <span className={`${UI_SKELETON_PULSE_CLASS} ${className}`} aria-hidden />;
}

function ListSkeletonBody() {
  return (
    <>
      <PulseBlock className="h-10 w-full max-w-2xl" />
      <ul className={`${UI_PAGE_SECTION_GAP_CLASS} ${UI_LIST_STACK_CLASS}`}>
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i}>
            <section className={UI_SKELETON_LIST_CARD_CLASS}>
              <section className="flex gap-2">
                <PulseBlock className="h-5 w-20" />
                <PulseBlock className="h-5 w-16" />
              </section>
              <PulseBlock className="mt-3 h-4 w-3/5 max-w-xs" />
              <PulseBlock className="mt-2 h-3 w-2/5 max-w-[12rem]" />
            </section>
          </li>
        ))}
      </ul>
    </>
  );
}

function DetailSkeletonBody() {
  return (
    <>
      <PulseBlock className="h-4 w-28" />
      <section className={`${UI_PAGE_SECTION_GAP_CLASS} space-y-3 sm:space-y-4`}>
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <section className="border-b border-zinc-100 p-3.5 sm:p-4">
            <PulseBlock className="h-7 w-2/3 max-w-sm" />
            <PulseBlock className="mt-2 h-4 w-1/2 max-w-xs" />
          </section>
          <section className="mx-3.5 mb-3.5 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3.5 sm:mx-4 sm:mb-4 sm:p-4">
            <PulseBlock className="h-5 w-32" />
            <PulseBlock className="mt-2 h-4 w-full" />
          </section>
        </section>
        <section className={UI_SKELETON_LIST_CARD_CLASS}>
          <PulseBlock className="h-4 w-28" />
          <section className="mt-3 grid gap-3 sm:grid-cols-2">
            <PulseBlock className="h-12 w-full" />
            <PulseBlock className="h-12 w-full" />
            <PulseBlock className="h-12 w-full" />
            <PulseBlock className="h-12 w-full" />
          </section>
        </section>
        <section className={UI_SKELETON_LIST_CARD_CLASS}>
          <PulseBlock className="h-4 w-24" />
          <PulseBlock className="mt-3 h-24 w-full" />
        </section>
      </section>
    </>
  );
}

export function DashboardPageSkeleton({ variant = "list", showShell = true }: Props) {
  const body = variant === "detail" ? <DetailSkeletonBody /> : <ListSkeletonBody />;

  if (!showShell) {
    return (
      <section role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">{DASHBOARD_LOADING_SR_LABEL}</span>
        {body}
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-zinc-50" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{DASHBOARD_LOADING_SR_LABEL}</span>
      <header className="border-b border-zinc-200 bg-white">
        <section className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <section className="space-y-2">
            <PulseBlock className="h-5 w-40" />
            <PulseBlock className="h-3 w-56" />
          </section>
          <section className="flex flex-wrap gap-2">
            <PulseBlock className="h-8 w-16" />
            <PulseBlock className="h-8 w-20" />
            <PulseBlock className="h-8 w-16" />
          </section>
        </section>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{body}</main>
    </section>
  );
}
