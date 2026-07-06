import type { BudgetConfig } from "./config.js";

export const CUSTOM_TYPE = "pi-budget-control";

export interface BudgetState {
  enabled: boolean;
  ignoreNext: boolean;
  ignoredUntil: number | null;
  sessionCapPercent: number | null;
}

export interface BudgetEntryData {
  enabled?: boolean;
  ignoreNext?: boolean;
  ignoredUntil?: number | null;
  sessionCapPercent?: number | null;
}

export function initialState(config: BudgetConfig): BudgetState {
  return {
    enabled: config.defaultEnabled,
    ignoreNext: false,
    ignoredUntil: null,
    sessionCapPercent: null,
  };
}

export function restoreState(entries: readonly unknown[], config: BudgetConfig): BudgetState {
  const state = initialState(config);

  for (const entry of entries) {
    const data = readBudgetEntryData(entry);
    if (!data) continue;

    if (typeof data.enabled === "boolean") state.enabled = data.enabled;
    if (typeof data.ignoreNext === "boolean") state.ignoreNext = data.ignoreNext;
    if (typeof data.ignoredUntil === "number" || data.ignoredUntil === null) state.ignoredUntil = data.ignoredUntil;
    if (typeof data.sessionCapPercent === "number" || data.sessionCapPercent === null) state.sessionCapPercent = data.sessionCapPercent;
  }

  if (state.ignoredUntil !== null && state.ignoredUntil <= Date.now()) state.ignoredUntil = null;
  return state;
}

export function hasActiveBypass(state: BudgetState, now = Date.now()): boolean {
  return state.ignoreNext || (state.ignoredUntil !== null && state.ignoredUntil > now);
}

export function consumeOneTurnBypass(state: BudgetState, now = Date.now()): boolean {
  if (state.ignoredUntil !== null && state.ignoredUntil > now) return true;
  if (!state.ignoreNext) return false;

  state.ignoreNext = false;
  return true;
}

export function effectiveConfig(config: BudgetConfig, state: BudgetState): BudgetConfig {
  if (state.sessionCapPercent === null) return config;
  return {
    ...config,
    capPercent: state.sessionCapPercent,
    warnPercent: Math.max(0, state.sessionCapPercent - 2),
  };
}

export function parseCapPercent(input: string): number | undefined {
  const parsed = Number(input.trim());
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return undefined;
  return parsed;
}

export function parseDurationMs(input: string): number | undefined {
  const match = /^(\d+)(m|h)$/i.exec(input.trim());
  if (!match) return undefined;

  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0) return undefined;

  const unit = match[2]?.toLowerCase();
  return unit === "h" ? amount * 60 * 60_000 : amount * 60_000;
}

function readBudgetEntryData(entry: unknown): BudgetEntryData | undefined {
  if (!isRecord(entry) || entry.type !== "custom" || entry.customType !== CUSTOM_TYPE) return undefined;
  return isRecord(entry.data) ? entry.data : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
