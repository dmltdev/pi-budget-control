export interface BudgetConfig {
  readonly provider: string;
  readonly windowId: string;
  readonly capPercent: number;
  readonly warnPercent: number;
  readonly cacheMs: number;
  readonly ompBin: string;
  readonly failClosed: boolean;
  readonly defaultEnabled: boolean;
}

const DEFAULT_CAP_PERCENT = 20;
const DEFAULT_WARN_PERCENT = 18;
const DEFAULT_CACHE_MS = 30_000;

export function readConfig(env: NodeJS.ProcessEnv = process.env): BudgetConfig {
  const capPercent = readPercent(env.PI_BUDGET_CAP_PERCENT, DEFAULT_CAP_PERCENT);

  return {
    provider: readNonEmpty(env.PI_BUDGET_PROVIDER, "openai-codex"),
    windowId: readNonEmpty(env.PI_BUDGET_WINDOW, "5h"),
    capPercent,
    warnPercent: Math.min(readPercent(env.PI_BUDGET_WARN_PERCENT, DEFAULT_WARN_PERCENT), capPercent),
    cacheMs: readPositiveInt(env.PI_BUDGET_CACHE_MS, DEFAULT_CACHE_MS),
    ompBin: readNonEmpty(env.PI_BUDGET_OMP_BIN, "omp"),
    failClosed: env.PI_BUDGET_FAIL_OPEN !== "1",
    defaultEnabled: env.PI_BUDGET_DEFAULT_OFF !== "1",
  };
}

function readNonEmpty(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function readPercent(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? NaN : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? NaN : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}
