import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveBookPageServiceSlug } from "@/features/booking-wizard/bookServiceRoute";
import { CustomerBookPage } from "../CustomerBookPage";

export const metadata: Metadata = {
  title: "Book a clean",
  description: "Book Shalean Cleaning Services",
};

type PageProps = {
  params: Promise<{ serviceSlug: string }>;
};

export default async function CustomerBookServicePage({ params }: PageProps) {
  const { serviceSlug } = await params;
  const slug = resolveBookPageServiceSlug(serviceSlug);
  if (!slug) {
    notFound();
  }

  return (
    <CustomerBookPage
      redirectPath={`/customer/book/${serviceSlug}`}
      initialServiceSlug={slug}
    />
  );
}
