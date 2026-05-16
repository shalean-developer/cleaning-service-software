import type { Metadata } from "next";
import { BookingWizard } from "@/features/booking-wizard";
import { checkCustomerReadiness } from "@/lib/auth/customerReadiness";
import { requireCustomerReady } from "@/lib/auth/requireCustomerReady";

export const metadata: Metadata = {
  title: "Book a clean",
  description: "Book Shalean Cleaning Services",
};

export default async function CustomerBookPage() {
  await requireCustomerReady("/customer/book");

  const readiness = await checkCustomerReadiness();
  if (readiness.status !== "ready") {
    return null;
  }

  const email = readiness.user.authUser.email?.trim() ?? "";

  return <BookingWizard customerEmail={email} />;
}
