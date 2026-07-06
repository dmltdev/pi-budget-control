import type { ExtensionAPI, ExtensionContext, InputEvent, ToolCallEvent } from "@oh-my-pi/pi-coding-agent/extensibility/extensions";
import { readConfig, type BudgetConfig } from "./config.js";
import { assessUsage, type BudgetAssessment, type OmpUsageReport } from "./usage.js";
import { CUSTOM_TYPE, consumeOneTurnBypass, effectiveConfig, hasActiveBypass, initialState, parseCapPercent, parseDurationMs, restoreState, type BudgetState } from "./state.js";

const BLOCKED_TOOL_NAMES: Record<string, true> = {
  ast_edit: true,
  bash: true,
  browser: true,
  debug: true,
  edit: true,
  task: true,
  write: true,
};

interface CachedAssessment {
  readonly assessment: BudgetAssessment;
  readonly fetchedAt: number;
}

type Exec = ExtensionAPI["exec"];

export default function budgetControl(pi: ExtensionAPI): void {
  const config = readConfig();
  let state = initialState(config);
  let activeTurnBypass = false;
  let cached: CachedAssessment | undefined;

  pi.registerCommand("budget", {
    description: "Show or change 5-hour provider budget control",
    getArgumentCompletions(argumentPrefix) {
      return ["status", "on", "off", "ignore once", "ignore 30m", "cap 80", "cap reset", "config"]
        .filter((item) => item.startsWith(argumentPrefix.trim()))
        .map((label) => ({ label, value: label }));
    },
    async handler(args, ctx) {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const command = parts[0] ?? "status";

      if (command === "status") {
        await showStatus(ctx, config, state, pi, () => getAssessment(ctx, effectiveConfig(config, state), cached, pi.exec), (next) => {
          cached = next;
        });
        return;
      }

      if (command === "on") {
        state.enabled = true;
        pi.appendEntry(CUSTOM_TYPE, { enabled: true });
        notify(ctx, "Budget control is on.", "info", pi);
        return;
      }

      if (command === "off") {
        state.enabled = false;
        pi.appendEntry(CUSTOM_TYPE, { enabled: false });
        notify(ctx, "Budget control is off. Run /budget on to re-enable it.", "warning", pi);
        return;
      }

      if (command === "ignore") {
        const target = parts[1];
        if (target === "once") {
          state.ignoreNext = true;
          pi.appendEntry(CUSTOM_TYPE, { ignoreNext: true });
          notify(ctx, "Budget control will ignore the next prompt once.", "warning", pi);
          return;
        }

        if (target) {
          const durationMs = parseDurationMs(target);
          if (durationMs !== undefined) {
            state.ignoredUntil = Date.now() + durationMs;
            pi.appendEntry(CUSTOM_TYPE, { ignoredUntil: state.ignoredUntil });
            notify(ctx, `Budget control ignored for ${target}.`, "warning", pi);
            return;
          }
        }
      }

      if (command === "cap") {
        const target = parts[1];
        if (target === "reset") {
          state.sessionCapPercent = null;
          cached = undefined;
          pi.appendEntry(CUSTOM_TYPE, { sessionCapPercent: null });
          notify(ctx, `Session cap reset. Global cap from env/config is ${config.capPercent}%.`, "info", pi);
          return;
        }

        if (target) {
          const capPercent = parseCapPercent(target);
          if (capPercent !== undefined) {
            state.sessionCapPercent = capPercent;
            cached = undefined;
            pi.appendEntry(CUSTOM_TYPE, { sessionCapPercent: capPercent });
            notify(ctx, `Session cap set to ${capPercent}%. This only affects the current session.`, "info", pi);
            return;
          }
        }
      }

      if (command === "config") {
        notify(ctx, formatConfig(config, state), "info", pi);
        return;
      }

      notify(ctx, "Usage: /budget [status|on|off|ignore once|ignore 30m|cap 80|cap reset|config]", "error", pi);
    },
  });

  pi.on("session_start", (_event, ctx) => {
    state = restoreState(ctx.sessionManager.getEntries(), config);
    if (!state.enabled) {
      pi.sendMessage(
        {
          customType: CUSTOM_TYPE,
          content: "Budget control is turned off. To enable it, run /budget on.",
          display: true,
          attribution: "agent",
        },
        { triggerTurn: false },
      );
    }
  });

  pi.on("input", async (event, ctx) => {
    if (shouldSkipInput(event, state)) return;

    if (consumeOneTurnBypass(state)) {
      activeTurnBypass = true;
      pi.appendEntry(CUSTOM_TYPE, { ignoreNext: state.ignoreNext });
      return;
    }

    const currentConfig = effectiveConfig(config, state);
    const assessment = await getFreshAssessment(ctx, currentConfig, pi.exec, (next) => {
      cached = next;
    });
    updateStatus(ctx, assessment, currentConfig);

    if (shouldBlock(assessment, currentConfig)) {
      notify(ctx, `${assessment.message} Run /budget ignore once, /budget ignore 30m, or /budget off to bypass.`, "error", pi);
      return { handled: true };
    }

    if (assessment.kind === "warn") notify(ctx, assessment.message, "warning", pi);
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!state.enabled || activeTurnBypass || hasActiveBypass(state) || !shouldBlockTool(event)) return;

    const currentConfig = effectiveConfig(config, state);
    const assessment = await getAssessment(ctx, currentConfig, cached, pi.exec);
    cached = { assessment, fetchedAt: Date.now() };
    updateStatus(ctx, assessment, currentConfig);

    if (!shouldBlock(assessment, currentConfig)) return;

    return {
      block: true,
      reason: `${assessment.message} ${event.toolName} is blocked by budget control.`,
    };
  });

  pi.on("agent_end", () => {
    activeTurnBypass = false;
  });
}

function shouldSkipInput(event: InputEvent, state: BudgetState): boolean {
  return !state.enabled || event.source === "extension" || event.text.trimStart().startsWith("/");
}

function shouldBlockTool(event: ToolCallEvent): boolean {
  return BLOCKED_TOOL_NAMES[event.toolName] === true;
}

function shouldBlock(assessment: BudgetAssessment, config: BudgetConfig): boolean {
  return assessment.kind === "blocked" || (assessment.kind === "unavailable" && config.failClosed);
}

async function showStatus(
  ctx: ExtensionContext,
  config: BudgetConfig,
  state: BudgetState,
  pi: ExtensionAPI,
  readAssessment: () => Promise<BudgetAssessment>,
  storeAssessment: (next: CachedAssessment) => void,
): Promise<void> {
  const currentConfig = effectiveConfig(config, state);
  const assessment = await readAssessment();
  storeAssessment({ assessment, fetchedAt: Date.now() });
  updateStatus(ctx, assessment, currentConfig);

  const mode = state.enabled ? "on" : "off";
  const capSource = state.sessionCapPercent === null ? "global" : "session";
  const bypass = hasActiveBypass(state) ? "bypass active" : "no bypass";
  notify(ctx, `Budget control ${mode}; ${bypass}; cap=${currentConfig.capPercent}% (${capSource}). ${assessment.message}`, assessment.kind === "blocked" ? "error" : assessment.kind === "warn" ? "warning" : "info", pi);
}

async function getAssessment(ctx: ExtensionContext, config: BudgetConfig, cached: CachedAssessment | undefined, exec: Exec): Promise<BudgetAssessment> {
  const now = Date.now();
  if (cached && now - cached.fetchedAt <= config.cacheMs) return cached.assessment;
  return readUsageAssessment(ctx, config, exec);
}

async function getFreshAssessment(ctx: ExtensionContext, config: BudgetConfig, exec: Exec, storeAssessment: (next: CachedAssessment) => void): Promise<BudgetAssessment> {
  const assessment = await readUsageAssessment(ctx, config, exec);
  storeAssessment({ assessment, fetchedAt: Date.now() });
  return assessment;
}

async function readUsageAssessment(ctx: ExtensionContext, config: BudgetConfig, exec: Exec): Promise<BudgetAssessment> {
  const result = await exec(config.ompBin, ["usage", "--json", "--provider", config.provider], { timeout: 30_000, cwd: ctx.cwd });
  if (result.code !== 0) return { kind: "unavailable", message: result.stderr || "omp usage failed." };

  try {
    return assessUsage(JSON.parse(result.stdout) as OmpUsageReport, config);
  } catch (error) {
    return { kind: "unavailable", message: `Could not parse omp usage output: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function updateStatus(ctx: ExtensionContext, assessment: BudgetAssessment, config: BudgetConfig): void {
  if (assessment.kind === "unavailable") {
    ctx.ui.setStatus(CUSTOM_TYPE, `budget ?/${config.capPercent}%`);
    return;
  }

  ctx.ui.setStatus(CUSTOM_TYPE, `budget ${Math.round(assessment.usedPercent)}%/${config.capPercent}%`);
}

function notify(ctx: ExtensionContext, message: string, type: "info" | "warning" | "error", pi?: ExtensionAPI): void {
  ctx.ui.notify(message, type);
  if (!pi) return;
  pi.sendMessage({ customType: CUSTOM_TYPE, content: message, display: true, attribution: "agent" }, { triggerTurn: false });
}

function formatConfig(config: BudgetConfig, state: BudgetState): string {
  const currentConfig = effectiveConfig(config, state);
  return [
    `provider=${currentConfig.provider}`,
    `window=${currentConfig.windowId}`,
    `cap=${currentConfig.capPercent}%${state.sessionCapPercent === null ? " (global env/config)" : " (current session)"}`,
    `warn=${currentConfig.warnPercent}%`,
    `failClosed=${currentConfig.failClosed}`,
    `cacheMs=${currentConfig.cacheMs}`,
  ].join("\n");
}
