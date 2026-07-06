# pi-budget-control

OMP extension that keeps a session inside a 5-hour provider usage budget.

## Behavior

- Reads `omp usage --json --provider openai-codex`.
- Enforces only the `5h` usage window by default.
- Blocks new user prompts when the selected 5-hour window reaches the effective cap.
- Warns 2 percentage points before the effective cap.
- Ignores 7-day windows. They are observability, not enforcement.
- Blocks exec/write-class tool calls over cap: `bash`, `debug`, `edit`, `write`, `task`, `ast_edit`, `browser`.
- Allows slash commands and read/status work so the user can inspect or change policy.

## Commands

```text
/budget status
/budget on
/budget off
/budget ignore once
/budget ignore 30m
/budget cap 80
/budget cap reset
/budget config
```

If budget control is off when a session starts, the extension injects a visible notice: `Budget control is turned off. To enable it, run /budget on.`

## Config

Global defaults are configured with environment variables. `/budget cap <percent>` is a current-session override only; it does not edit global config or environment variables.

Environment variables:

| Variable | Default | Meaning |
|---|---:|---|
| `PI_BUDGET_PROVIDER` | `openai-codex` | Provider passed to `omp usage --provider` |
| `PI_BUDGET_WINDOW` | `5h` | Enforced usage window |
| `PI_BUDGET_CAP_PERCENT` | `20` | Global default block threshold |
| `PI_BUDGET_WARN_PERCENT` | `18` | Global default warning threshold when no session cap is active |
| `PI_BUDGET_CACHE_MS` | `30000` | Usage snapshot cache TTL |
| `PI_BUDGET_OMP_BIN` | `omp` | CLI used to read usage |
| `PI_BUDGET_FAIL_OPEN` | unset | Set `1` to allow prompts if usage cannot be read |
| `PI_BUDGET_DEFAULT_OFF` | unset | Set `1` to start disabled |

## Local development

```sh
pnpm install
pnpm test
pnpm typecheck
omp --extension .
```

## Marketplace development install

```sh
omp plugin marketplace add ./. 
omp plugin install pi-budget-control@pi-budget-control-dev --force
```
