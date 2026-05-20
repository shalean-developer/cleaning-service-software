import type { Metadata } from "next";
import { buildPaymentFailedPageModel } from "@/lib/app/paymentFailedPage";
import { PaymentFailedPageContent } from "./PaymentFailedPageContent";

export const metadata: Metadata = {
  title: "Payment not completed",
  description: "Your payment could not be completed",
};

type Props = {
  searchParams: Promise<{
    reason?: string;
    bookingId?: string;
    booking?: string;
    reference?: string;
    service?: string;
  }>;
};

export default async function PaymentFailedPage({ searchParams }: Props) {
  const params = await searchParams;
  const model = buildPaymentFailedPageModel(params);

  return <PaymentFailedPageContent model={model} />;
}
