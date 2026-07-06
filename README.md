# pi-budget-control

Pi / Oh My Pi extension that keeps a session inside a 5-hour provider usage budget.

The extension supports both harness binaries:

- `omp` (Oh My Pi) by default.
- `pi` when `PI_BUDGET_OMP_BIN=pi` is set.

## Behavior

- Reads `<harness> usage --json --provider openai-codex`, where `<harness>` is `omp` by default or `PI_BUDGET_OMP_BIN`.
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
| `PI_BUDGET_PROVIDER` | `openai-codex` | Provider passed to `<harness> usage --provider` |
| `PI_BUDGET_WINDOW` | `5h` | Enforced usage window |
| `PI_BUDGET_CAP_PERCENT` | `20` | Global default block threshold |
| `PI_BUDGET_WARN_PERCENT` | `18` | Global default warning threshold when no session cap is active |
| `PI_BUDGET_CACHE_MS` | `30000` | Usage snapshot cache TTL |
| `PI_BUDGET_OMP_BIN` | `omp` | Harness CLI used to read usage. Set to `pi` for Pi. |
| `PI_BUDGET_FAIL_OPEN` | unset | Set `1` to allow prompts if usage cannot be read |
| `PI_BUDGET_DEFAULT_OFF` | unset | Set `1` to start disabled |

## Local development

```sh
pnpm install
pnpm test
pnpm typecheck
omp --extension .
PI_BUDGET_OMP_BIN=pi pi --extension .
```

## Marketplace development install

Oh My Pi:

```sh
omp plugin marketplace add ./.
omp plugin install pi-budget-control@pi-budget-control-dev --force
```

Pi uses the same extension package layout; install with the equivalent Pi plugin command, or load locally with `pi --extension .`.
