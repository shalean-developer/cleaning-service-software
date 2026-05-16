import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment not completed",
  description: "Your payment could not be completed",
};

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function PaymentFailedPage({ searchParams }: Props) {
  const params = await searchParams;
  const reason = params.reason?.trim();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-16">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Payment not completed</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {reason ??
            "Your booking was not confirmed. No charge was finalized in our system, or the payment was cancelled."}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/customer/book"
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            Try booking again
          </Link>
          <Link
            href="/customer/bookings"
            className="text-center text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
          >
            View my bookings
          </Link>
        </div>
      </section>
    </main>
  );
}
