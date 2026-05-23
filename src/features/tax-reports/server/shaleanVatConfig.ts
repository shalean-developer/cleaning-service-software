import "server-only";

export type ShaleanVatConfig = {
  vatRegistered: boolean;
  vatRate: number;
};

function readBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw !== "false" && raw !== "0";
}

function readVatRate(): number {
  const raw = process.env.SHALEAN_VAT_RATE?.trim();
  if (!raw) return 15;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 15;
  return parsed;
}

export function getShaleanVatConfig(): ShaleanVatConfig {
  return {
    vatRegistered: readBooleanEnv("SHALEAN_VAT_REGISTERED", false),
    vatRate: readVatRate(),
  };
}
