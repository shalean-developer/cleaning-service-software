import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MARKETING_SITE_URL,
  getMarketingCanonicalUrl,
  getMarketingSiteUrl,
} from "./siteUrl";

describe("getMarketingSiteUrl", () => {
  const prevMarketing = process.env.NEXT_PUBLIC_MARKETING_SITE_URL;
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_MARKETING_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (prevMarketing === undefined) delete process.env.NEXT_PUBLIC_MARKETING_SITE_URL;
    else process.env.NEXT_PUBLIC_MARKETING_SITE_URL = prevMarketing;
    if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevApp;
  });

  it("defaults to production domain when env is unset", () => {
    expect(getMarketingSiteUrl()).toBe(DEFAULT_MARKETING_SITE_URL);
  });

  it("rejects localhost from NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(getMarketingSiteUrl()).toBe(DEFAULT_MARKETING_SITE_URL);
  });

  it("rejects Vercel preview URLs", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://cleaning-services-software.vercel.app";
    expect(getMarketingSiteUrl()).toBe(DEFAULT_MARKETING_SITE_URL);
  });

  it("rejects www subdomain", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.shalean.co.za";
    expect(getMarketingSiteUrl()).toBe(DEFAULT_MARKETING_SITE_URL);
  });

  it("accepts explicit marketing site URL", () => {
    process.env.NEXT_PUBLIC_MARKETING_SITE_URL = "https://shalean.co.za/";
    expect(getMarketingSiteUrl()).toBe("https://shalean.co.za");
  });
});

describe("getMarketingCanonicalUrl", () => {
  it("builds absolute URLs from canonical origin", () => {
    expect(getMarketingCanonicalUrl("/faq")).toBe("https://shalean.co.za/faq");
    expect(getMarketingCanonicalUrl("/")).toBe("https://shalean.co.za");
  });
});
