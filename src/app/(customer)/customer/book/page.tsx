import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BookingWizard } from "@/features/booking-wizard";
import { buildSignInRedirectPath } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Book a clean",
  description: "Book Shalean Cleaning Services",
};

export default async function CustomerBookPage() {
  const user = await getCurrentUser();
  if (!user) {
    const pathname = (await headers()).get("x-pathname") ?? "/customer/book";
    redirect(buildSignInRedirectPath(pathname));
  }

  const email = user.authUser.email?.trim() ?? "";

  return <BookingWizard customerEmail={email} />;
}
