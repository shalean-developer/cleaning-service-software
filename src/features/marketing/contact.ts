/** Public marketing contact. override via NEXT_PUBLIC_* in production. */
const phoneE164 =
  process.env.NEXT_PUBLIC_SHALEAN_PHONE_E164?.trim() || "+27871535250";
const phoneDisplay =
  process.env.NEXT_PUBLIC_SHALEAN_PHONE_DISPLAY?.trim() || "087 153 5250";
const whatsappNumber =
  process.env.NEXT_PUBLIC_SHALEAN_WHATSAPP?.trim() || "27825915525";

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

export const SHALEAN_SOCIAL = {
  facebook:
    process.env.NEXT_PUBLIC_SHALEAN_FACEBOOK_URL?.trim() ||
    "https://www.facebook.com/shaleancleaning/",
  instagram:
    process.env.NEXT_PUBLIC_SHALEAN_INSTAGRAM_URL?.trim() ||
    "https://www.instagram.com/shalean_cleaning_services/",
  linkedIn:
    process.env.NEXT_PUBLIC_SHALEAN_LINKEDIN_URL?.trim() ||
    "https://www.linkedin.com/in/shalean-cleaning-services-undefined-264687360/",
} as const;
