/** Presentation-only Shalean mark for auth pages. */
export function SignInBrandMark() {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-bold tracking-tight text-white shadow-[0_2px_10px_rgba(24,24,27,0.15)]"
        aria-hidden
      >
        S
      </span>
      <p className="mt-3 text-base font-semibold tracking-tight text-zinc-900">Shalean</p>
      <p className="text-xs text-zinc-500">Cleaning Services</p>
    </div>
  );
}
