#!/usr/bin/env node
/**
 * Location launch readiness audit — static checks + optional HTTP crawl.
 *
 * Usage:
 *   npm run ops:audit:location-launch
 *   LOCATION_LAUNCH_BASE_URL=http://localhost:3000 npm run ops:audit:location-launch
 *   npm run ops:audit:location-launch -- --live https://shalean.co.za
 */
import { spawnSync } from "node:child_process";
import {
  printCrawlReport,
  runLocationLaunchCrawl,
} from "./lib/location-launch-crawl.mjs";

function runVitest(testFile) {
  return spawnSync("npx", ["vitest", "run", testFile, "--reporter=dot"], {
    stdio: "inherit",
    shell: true,
    cwd: process.cwd(),
  });
}

function resolveBaseUrl() {
  const liveArg = process.argv.find((a) => a.startsWith("--live"));
  if (liveArg) {
    const url = liveArg.includes("=") ? liveArg.split("=")[1] : process.argv[process.argv.indexOf(liveArg) + 1];
    if (url) return url.trim();
  }
  return process.env.LOCATION_LAUNCH_BASE_URL?.trim() || null;
}

let exitCode = 0;

console.log("--- Registry audit ---");
const registry = runVitest("src/features/locations/locationRegistry.audit.test.ts");
if (registry.status !== 0) exitCode = registry.status ?? 1;

console.log("\n--- Launch static audit ---");
const launch = runVitest("src/features/locations/locationLaunchAudit.test.ts");
if (launch.status !== 0) exitCode = launch.status ?? 1;

const baseUrl = resolveBaseUrl();
if (baseUrl) {
  console.log("\n--- HTTP crawl ---");
  try {
    const crawl = await runLocationLaunchCrawl(baseUrl);
    printCrawlReport(baseUrl, crawl);
    if (crawl.failures.length > 0) exitCode = 1;
  } catch (err) {
    console.error("HTTP crawl failed:", err instanceof Error ? err.message : err);
    console.error("Ensure the app is running at", baseUrl);
    exitCode = 1;
  }
} else {
  console.log(
    "\nHTTP crawl skipped. Set LOCATION_LAUNCH_BASE_URL or pass --live <url> after npm run start.\n",
  );
}

process.exit(exitCode);
