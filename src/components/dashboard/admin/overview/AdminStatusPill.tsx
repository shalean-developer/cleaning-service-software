type Props = {
  /** When true, appends a MOCK suffix (non-production environments). */
  showMock?: boolean;
};

export function AdminStatusPill({ showMock = false }: Props) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700"
      role="status"
      aria-label={showMock ? "Live mock operations data" : "Live operations"}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-40" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
      </span>
      <span>Live{showMock ? " · Mock" : ""}</span>
    </div>
  );
}
