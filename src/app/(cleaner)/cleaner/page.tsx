import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cleaner | Cleaning Services",
};

export default function CleanerHomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm text-zinc-600">
        Cleaner dashboard area (foundation). Domain routes live under{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">/cleaner</code>
        .
      </p>
    </main>
  );
}
