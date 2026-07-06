import { describe, expect, it, vi } from "vitest";
import type { BudgetConfig } from "../src/config.js";
import { CUSTOM_TYPE, consumeOneTurnBypass, effectiveConfig, hasActiveBypass, parseCapPercent, parseDurationMs, restoreState } from "../src/state.js";

const config: BudgetConfig = {
  provider: "openai-codex",
  windowId: "5h",
  capPercent: 20,
  warnPercent: 18,
  cacheMs: 30_000,
  ompBin: "omp",
  failClosed: true,
  defaultEnabled: true,
};

describe("budget bypass state", () => {
  it("when ignore once is consumed, then only one turn bypasses", () => {
    const state = { enabled: true, ignoreNext: true, ignoredUntil: null, sessionCapPercent: null };

    expect(consumeOneTurnBypass(state)).toBe(true);
    expect(consumeOneTurnBypass(state)).toBe(false);
  });

  it("when timed ignore has not expired, then every turn bypasses", () => {
    const state = { enabled: true, ignoreNext: false, ignoredUntil: 2_000, sessionCapPercent: null };

    expect(consumeOneTurnBypass(state, 1_000)).toBe(true);
    expect(consumeOneTurnBypass(state, 1_000)).toBe(true);
  });

  it("when restoring entries, then latest custom entry wins", () => {
    vi.setSystemTime(1_000);

    const state = restoreState(
      [
        { type: "custom", customType: CUSTOM_TYPE, data: { enabled: true } },
        { type: "custom", customType: CUSTOM_TYPE, data: { enabled: false, ignoreNext: true } },
      ],
      config,
    );

    expect(state).toEqual({ enabled: false, ignoreNext: true, ignoredUntil: null, sessionCapPercent: null });
  });

  it("when timed ignore expired before restore, then bypass is cleared", () => {
    vi.setSystemTime(10_000);

    const state = restoreState([{ type: "custom", customType: CUSTOM_TYPE, data: { ignoredUntil: 5_000 } }], config);

    expect(hasActiveBypass(state, 10_000)).toBe(false);
  });

  it("when restoring a session cap override, then it becomes the effective cap", () => {
    const state = restoreState([{ type: "custom", customType: CUSTOM_TYPE, data: { sessionCapPercent: 80 } }], config);

    expect(effectiveConfig(config, state).capPercent).toBe(80);
    expect(effectiveConfig(config, state).warnPercent).toBe(78);
  });

  it("when restoring a session cap reset, then global env config is effective again", () => {
    const state = restoreState(
      [
        { type: "custom", customType: CUSTOM_TYPE, data: { sessionCapPercent: 80 } },
        { type: "custom", customType: CUSTOM_TYPE, data: { sessionCapPercent: null } },
      ],
      config,
    );

    expect(effectiveConfig(config, state).capPercent).toBe(20);
    expect(effectiveConfig(config, state).warnPercent).toBe(18);
  });

  it("when parsing session cap commands, then only 1 through 100 are valid", () => {
    expect(parseCapPercent("80")).toBe(80);
    expect(parseCapPercent("100")).toBe(100);
    expect(parseCapPercent("0")).toBeUndefined();
    expect(parseCapPercent("101")).toBeUndefined();
    expect(parseCapPercent("abc")).toBeUndefined();
  });

  it("when parsing durations, then only minute and hour suffixes are valid", () => {
    expect(parseDurationMs("30m")).toBe(1_800_000);
    expect(parseDurationMs("2h")).toBe(7_200_000);
    expect(parseDurationMs("30d")).toBeUndefined();
  });
});
