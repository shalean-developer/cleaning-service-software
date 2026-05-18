export function PaymentVerificationSpinner() {
  return (
    <div
      className="relative mx-auto flex h-16 w-16 items-center justify-center"
      role="status"
      aria-label="Confirming your payment"
    >
      <div className="absolute inset-0 rounded-full border-[3px] border-zinc-200" aria-hidden />
      <div
        className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-zinc-900 motion-safe:animate-spin"
        style={{ animationDuration: "0.85s" }}
        aria-hidden
      />
      <div className="h-2 w-2 rounded-full bg-zinc-300" aria-hidden />
    </div>
  );
}
