export type CronHealthLevel = "healthy" | "warning" | "critical" | "unknown";

export type CronScheduleSource =
  | "supabase_pg_cron"
  | "ops_configured"
  | "feature_gated";

export type CronJobDefinition = {
  id: string;
  name: string;
  routePath: string;
  scheduleSource: CronScheduleSource;
  /** Human-readable schedule hint for ops (not a live pg_cron probe). */
  scheduleHint: string;
  expectedFrequencyMinutes: number;
  docPath: string;
  launchRequired: boolean;
  /** When false, job is omitted or marked disabled unless feature flag is on. */
  featureFlagEnv?: string;
};

export type CronJobHealthSnapshot = {
  id: string;
  name: string;
  routePath: string;
  scheduleSource: CronScheduleSource;
  scheduleHint: string;
  expectedFrequencyMinutes: number;
  docPath: string;
  launchRequired: boolean;
  enabled: boolean;
  status: CronHealthLevel;
  statusMessage: string;
  lastSuccessfulRunAt: string | null;
  lastFailureRunAt: string | null;
  recentFailureCount24h: number | null;
  backlogCount: number;
  backlogLabel: string;
  hasRunTelemetry: boolean;
};

export type CronHealthReadModel = {
  generatedAt: string;
  cronSecretConfigured: boolean;
  jobs: CronJobHealthSnapshot[];
};
