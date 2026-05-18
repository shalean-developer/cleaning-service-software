import type { Metadata } from "next";
import { CustomerBookPage } from "./CustomerBookPage";

export const metadata: Metadata = {
  title: "Book a clean",
  description: "Book Shalean Cleaning Services",
};

export default async function CustomerBookPageRoute() {
  return <CustomerBookPage redirectPath="/customer/book" />;
}
