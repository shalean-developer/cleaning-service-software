/** Public marketing contact — override via NEXT_PUBLIC_* in production. */
const phoneE164 =
  process.env.NEXT_PUBLIC_SHALEAN_PHONE_E164?.trim() || "+27211234567";
const phoneDisplay =
  process.env.NEXT_PUBLIC_SHALEAN_PHONE_DISPLAY?.trim() || "021 123 4567";
const whatsappNumber =
  process.env.NEXT_PUBLIC_SHALEAN_WHATSAPP?.trim() || "27211234567";

export const SHALEAN_CONTACT = {
  phoneE164,
  phoneDisplay,
  whatsappNumber,
  email: "hello@shalean.co.za",
  address: "Cape Town, Western Cape, South Africa",
  /** Public Google Business / reviews destination (override when GBP URL is available). */
  googleReviewsUrl:
    process.env.NEXT_PUBLIC_SHALEAN_GOOGLE_REVIEWS_URL?.trim() ||
    "https://www.google.com/maps/search/?api=1&query=Shalean+Cleaning+Services+Cape+Town",
} as const;
