import type { BudgetConfig } from "./config.js";

export interface OmpUsageReport {
  readonly reports?: readonly ProviderUsageReport[];
}

export interface ProviderUsageReport {
  readonly provider?: string;
  readonly limits?: readonly ProviderLimit[];
}

export interface ProviderLimit {
  readonly id?: string;
  readonly label?: string;
  readonly scope?: {
    readonly provider?: string;
    readonly windowId?: string;
    readonly modelId?: string;
  };
  readonly window?: {
    readonly id?: string;
    readonly label?: string;
    readonly resetsAt?: number;
  };
  readonly amount?: {
    readonly used?: number;
    readonly limit?: number;
    readonly remaining?: number;
    readonly usedFraction?: number;
    readonly remainingFraction?: number;
    readonly unit?: string;
  };
  readonly status?: string;
}

export type BudgetAssessment =
  | {
      readonly kind: "ok" | "warn" | "blocked";
      readonly limit: ProviderLimit;
      readonly usedPercent: number;
      readonly remainingPercent: number;
      readonly message: string;
    }
  | {
      readonly kind: "unavailable";
      readonly message: string;
    };

export function assessUsage(report: OmpUsageReport, config: BudgetConfig): BudgetAssessment {
  const limit = selectMostUsedLimit(report, config);
  if (!limit) {
    return {
      kind: "unavailable",
      message: `No ${config.provider} ${config.windowId} usage limit was reported by omp usage.`,
    };
  }

  const usedPercent = percent(limit.amount?.usedFraction);
  const remainingPercent = percent(limit.amount?.remainingFraction);
  const label = limit.label ?? limit.window?.label ?? config.windowId;
  const model = limit.scope?.modelId ? ` (${limit.scope.modelId})` : "";
  const suffix = `${label}${model}: ${formatPercent(usedPercent)} used, ${formatPercent(remainingPercent)} remaining.`;

  if (usedPercent >= config.capPercent) {
    return {
      kind: "blocked",
      limit,
      usedPercent,
      remainingPercent,
      message: `Budget cap reached. ${suffix}`,
    };
  }

  if (usedPercent >= config.warnPercent) {
    return {
      kind: "warn",
      limit,
      usedPercent,
      remainingPercent,
      message: `Budget warning. ${suffix}`,
    };
  }

  return {
    kind: "ok",
    limit,
    usedPercent,
    remainingPercent,
    message: `Budget OK. ${suffix}`,
  };
}

export function selectMostUsedLimit(report: OmpUsageReport, config: Pick<BudgetConfig, "provider" | "windowId">): ProviderLimit | undefined {
  let selected: ProviderLimit | undefined;
  let selectedUsed = -1;

  for (const providerReport of report.reports ?? []) {
    if (providerReport.provider !== config.provider) continue;

    for (const limit of providerReport.limits ?? []) {
      const provider = limit.scope?.provider ?? providerReport.provider;
      const windowId = limit.scope?.windowId ?? limit.window?.id;
      if (provider !== config.provider || windowId !== config.windowId) continue;

      const used = percent(limit.amount?.usedFraction);
      if (used > selectedUsed) {
        selected = limit;
        selectedUsed = used;
      }
    }
  }

  return selected;
}

function percent(fraction: number | undefined): number {
  return Math.max(0, Math.min(100, (fraction ?? 0) * 100));
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}
