import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getMarketingSiteUrl } from "@/features/marketing/siteUrl";

export const metadata: Metadata = {
  metadataBase: new URL(getMarketingSiteUrl()),
};

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${plusJakarta.variable} font-marketing text-shalean-navy antialiased`}
      style={{ colorScheme: "light" }}
    >
      {children}
    </div>
  );
}
