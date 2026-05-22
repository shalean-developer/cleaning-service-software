import type { NextConfig } from "next";
import { buildLocationLegacyRedirects } from "./src/features/marketing/locationRedirects";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/pricing-cape-town",
        destination: "/cleaning-prices-cape-town",
        permanent: true,
      },
      {
        source: "/locations/cape-town",
        destination: "/locations",
        permanent: true,
      },
      ...buildLocationLegacyRedirects(),
      {
        source: "/service",
        destination: "/services",
        permanent: true,
      },
      {
        source: "/about-us",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/login",
        destination: "/sign-in",
        permanent: false,
      },
      {
        source: "/signup",
        destination: "/sign-up",
        permanent: false,
      },
      {
        source: "/cleaner/login",
        destination: "/sign-in?redirectedFrom=%2Fcleaner%2Foffers",
        permanent: false,
      },
      {
        source: "/careers",
        destination: "/apply",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
