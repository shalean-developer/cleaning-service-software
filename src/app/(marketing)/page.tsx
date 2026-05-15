import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cleaning Services",
  description: "Book trusted home and office cleaning.",
};

export default function MarketingHomePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        Marketing (foundation)
      </h1>
      <p className="text-sm leading-6 text-zinc-600">
        SEO-focused marketing pages will live under{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
          app/(marketing)
        </code>
        . This route group does not change the URL path.
      </p>
    </main>
  );
}
