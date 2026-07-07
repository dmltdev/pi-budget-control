import { describe, expect, it } from "vitest";
import type { BudgetConfig } from "../src/config.js";
import { assessUsage, selectMostUsedLimit, type OmpUsageReport } from "../src/usage.js";

const config: BudgetConfig = {
  provider: "openai-codex",
  windowId: "5h",
  capPercent: 95,
  warnPercent: 75,
  cacheMs: 30_000,
  ompBin: "omp",
  failClosed: true,
  defaultEnabled: true,
};

describe("5-hour provider budget assessment", () => {
  it("when only the 7-day limit is over cap, then it stays allowed", () => {
    const report = usageReport({ fiveHourUsed: 0.15, sevenDayUsed: 0.44 });

    expect(assessUsage(report, config).kind).toBe("ok");
  });

  it("when the 5-hour limit reaches the cap, then it blocks", () => {
    const report = usageReport({ fiveHourUsed: 0.95, sevenDayUsed: 0.1 });

    const assessment = assessUsage(report, config);

    expect(assessment.kind).toBe("blocked");
    expect(assessment.message).toContain("Budget cap reached");
  });

  it("when the 5-hour limit is near the cap, then it warns", () => {
    const report = usageReport({ fiveHourUsed: 0.75, sevenDayUsed: 0.1 });

    expect(assessUsage(report, config).kind).toBe("warn");
  });

  it("when several 5-hour model limits exist, then it checks the most used one", () => {
    const report: OmpUsageReport = {
      reports: [
        {
          provider: "openai-codex",
          limits: [limit("openai-codex:spark:primary", "5h", 0.1), limit("openai-codex:primary", "5h", 0.96)],
        },
      ],
    };

    expect(selectMostUsedLimit(report, config)?.id).toBe("openai-codex:primary");
    expect(assessUsage(report, config).kind).toBe("blocked");
  });
});

function usageReport(values: { fiveHourUsed: number; sevenDayUsed: number }): OmpUsageReport {
  return {
    reports: [
      {
        provider: "openai-codex",
        limits: [limit("openai-codex:primary", "5h", values.fiveHourUsed), limit("openai-codex:secondary", "7d", values.sevenDayUsed)],
      },
    ],
  };
}

function limit(id: string, windowId: string, usedFraction: number) {
  return {
    id,
    label: windowId === "5h" ? "5 hours" : "7 days",
    scope: { provider: "openai-codex", windowId },
    window: { id: windowId, label: windowId },
    amount: {
      usedFraction,
      remainingFraction: 1 - usedFraction,
      unit: "percent",
    },
  };
}
