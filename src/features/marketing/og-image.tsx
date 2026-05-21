import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = "image/png";

export type ShaleanOgImageParams = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

/** Branded 1200×630 Open Graph image (production-safe, no external assets). */
export function renderShaleanOgImage({
  eyebrow = "Shalean Cleaning Services",
  title,
  subtitle,
}: ShaleanOgImageParams) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0F172A 0%, #1e3a8a 55%, #2563EB 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#93C5FD",
            marginBottom: 24,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontSize: 32,
              fontWeight: 500,
              lineHeight: 1.35,
              color: "#DBEAFE",
              marginTop: 28,
              maxWidth: 920,
            }}
          >
            {subtitle}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 24,
            color: "#BFDBFE",
            gap: 32,
          }}
        >
          <span>shalean.co.za</span>
          <span>Cape Town</span>
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}
