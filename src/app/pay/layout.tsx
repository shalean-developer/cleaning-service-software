import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

export const metadata: Metadata = {
  title: "Pay invoice",
  description: "Pay your Shalean invoice securely online",
};

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${plusJakarta.variable} min-h-screen font-marketing text-shalean-navy antialiased`}
      style={{ colorScheme: "light" }}
    >
      {children}
    </div>
  );
}
