import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";
import {
  SERVICE_SEO_CONTENT,
  SERVICE_SEO_SLUGS,
  isServiceSeoSlug,
} from "@/features/marketing/seo-pages";

export const alt = "Shalean cleaning service in Cape Town";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

type OgProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return SERVICE_SEO_SLUGS.map((slug) => ({ slug }));
}

export default async function ServiceOgImage({ params }: OgProps) {
  const { slug } = await params;
  if (!isServiceSeoSlug(slug)) {
    return renderShaleanOgImage({ title: "Shalean Cleaning Services" });
  }
  const content = SERVICE_SEO_CONTENT[slug];
  return renderShaleanOgImage({
    eyebrow: "Cape Town",
    title: content.h1,
    subtitle: "Book vetted cleaners online",
  });
}
