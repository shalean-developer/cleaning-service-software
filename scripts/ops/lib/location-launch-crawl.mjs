/**
 * Optional HTTP crawl for location launch audit.
 * Requires a running server at baseUrl (e.g. npm run start after build).
 */
/** Keep aligned with src/features/marketing/locationSlugList.ts */
const LOCATION_SEO_SLUG_LIST = [
  "sea-point-cape-town",
  "claremont-cape-town",
  "camps-bay-cape-town",
  "century-city-cape-town",
  "bellville-cape-town",
  "durbanville-cape-town",
  "table-view-cape-town",
  "observatory-cape-town",
  "rondebosch-cape-town",
  "wynberg-cape-town",
  "green-point-cape-town",
  "milnerton-cape-town",
];

const INVALID_SLUG = "not-a-valid-suburb-cape-town";
const OPERATIONAL_ONLY = "atlantis-cape-town";

const SERVICE_PATHS = [
  "/services/regular-cleaning-cape-town",
  "/services/deep-cleaning-cape-town",
  "/services/move-in-out-cleaning-cape-town",
  "/services/airbnb-cleaning-cape-town",
  "/services/office-cleaning-cape-town",
  "/services/carpet-cleaning-cape-town",
];

function legacyPath(slug) {
  const segment = slug.replace(/-cape-town$/, "");
  return `/locations/${segment}`;
}

export function getCrawlPlan() {
  return {
    canonical200: ["/locations", ...LOCATION_SEO_SLUG_LIST.map((s) => `/locations/${s}`), "/services", ...SERVICE_PATHS, "/cleaning-prices-cape-town"],
    legacyRedirect: LOCATION_SEO_SLUG_LIST.map((s) => legacyPath(s)),
    notFound: [`/locations/${INVALID_SLUG}`, `/locations/${OPERATIONAL_ONLY}`],
  };
}

/**
 * @param {string} baseUrl
 * @param {string} pathname
 * @param {{ redirect?: RequestRedirect }} [options]
 */
async function fetchPath(baseUrl, pathname, options = {}) {
  const url = `${baseUrl.replace(/\/$/, "")}${pathname}`;
  const res = await fetch(url, { redirect: options.redirect ?? "manual" });
  return {
    pathname,
    status: res.status,
    location: res.headers.get("location"),
  };
}

/**
 * @param {string} baseUrl
 */
export async function runLocationLaunchCrawl(baseUrl) {
  const plan = getCrawlPlan();
  const failures = [];
  const passes = [];

  for (const pathname of plan.canonical200) {
    const result = await fetchPath(baseUrl, pathname);
    if (result.status !== 200) {
      failures.push({ check: "canonical-200", ...result, expected: 200 });
    } else {
      passes.push(`200 ${pathname}`);
    }
  }

  for (const pathname of plan.legacyRedirect) {
    const first = await fetchPath(baseUrl, pathname);
    const redirectStatus = first.status;
    if (redirectStatus !== 308 && redirectStatus !== 301) {
      failures.push({
        check: "legacy-redirect",
        ...first,
        expected: "308 or 301",
      });
      continue;
    }
    if (!first.location?.includes("-cape-town")) {
      failures.push({
        check: "legacy-destination",
        ...first,
        expected: "destination must be canonical -cape-town URL",
      });
      continue;
    }

    const second = await fetchPath(baseUrl, pathname, { redirect: "follow" });
    if (second.status !== 200) {
      failures.push({
        check: "legacy-chain",
        pathname,
        status: second.status,
        expected: "200 after single redirect",
      });
    } else {
      passes.push(`redirect ${pathname} → 200`);
    }
  }

  for (const pathname of plan.notFound) {
    const result = await fetchPath(baseUrl, pathname);
    if (result.status !== 404) {
      failures.push({ check: "not-found", ...result, expected: 404 });
    } else {
      passes.push(`404 ${pathname}`);
    }
  }

  const bodySample = await fetch(`${baseUrl.replace(/\/$/, "")}/locations/sea-point-cape-town`);
  const html = await bodySample.text();
  if (html.includes('href="/service"') || html.includes("href='/service'")) {
    failures.push({
      check: "no-legacy-service-link",
      pathname: "/locations/sea-point-cape-town",
      message: "Page contains legacy /service link",
    });
  }
  if (/\/locations\/sea-point["']/.test(html)) {
    failures.push({
      check: "no-short-slug-link",
      pathname: "/locations/sea-point-cape-town",
      message: "Page contains short /locations/sea-point link",
    });
  }

  return { passes, failures, plan };
}

export function printCrawlReport(baseUrl, result) {
  console.log(`\n=== Location launch HTTP crawl ===\n`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Checks passed: ${result.passes.length}`);
  if (result.failures.length === 0) {
    console.log("\nHTTP crawl: PASS\n");
    return;
  }
  console.log(`\nHTTP crawl: FAIL (${result.failures.length} issue(s))\n`);
  for (const f of result.failures) {
    console.log(`  [${f.check}] ${f.pathname} status=${f.status ?? "?"} expected=${f.expected ?? f.message ?? "?"}`);
    if (f.location) console.log(`    location: ${f.location}`);
  }
  console.log("");
}
