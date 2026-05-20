import type { MetadataRoute } from "next";
import { getMarketingSiteUrl } from "@/features/marketing/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getMarketingSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/customer/",
        "/cleaner/",
        "/sign-in",
        "/sign-up",
        "/payment/",
        "/reset-password",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
