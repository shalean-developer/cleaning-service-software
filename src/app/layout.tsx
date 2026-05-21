import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  SHALEAN_METADATA_TITLE_DEFAULT,
  SHALEAN_METADATA_TITLE_TEMPLATE,
} from "@/features/marketing/metadata";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: SHALEAN_METADATA_TITLE_DEFAULT,
    template: SHALEAN_METADATA_TITLE_TEMPLATE,
  },
  description:
    "Professional home and office cleaning in Cape Town. Book vetted Shalean cleaners online.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-ZA"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
