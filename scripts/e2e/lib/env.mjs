import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvFiles(cwd = process.cwd()) {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export function requireServiceRoleClient(createClient) {
  loadEnvFiles();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function upsertEnvLocal(updates, cwd = process.cwd()) {
  const envPath = resolve(cwd, ".env.local");
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split("\n") : [];
  const map = new Map();
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) {
      map.set(`__comment_${map.size}`, line);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    map.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  for (const [key, value] of Object.entries(updates)) {
    map.set(key, value);
  }
  const out = [];
  for (const [key, value] of map) {
    if (key.startsWith("__comment_")) {
      out.push(value);
    } else {
      out.push(`${key}=${value}`);
    }
  }
  const body = out.join("\n");
  writeFileSync(envPath, body.endsWith("\n") ? body : `${body}\n`);
}
