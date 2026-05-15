import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | Cleaning Services",
};

export default function AdminHomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm text-zinc-600">
        Admin operations area (foundation). Domain routes live under{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">/admin</code>.
      </p>
    </main>
  );
}
