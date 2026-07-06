# Budget control

## Purpose

Budget control keeps an OMP session from spending past a user-owned short-window usage cap.

## Language

- Budget control is the guard.
- Cap is the enforced percentage. A session cap overrides the global cap for the current session only.
- Bypass is explicit user permission to continue.
- 5-hour window is enforceable.
- 7-day window is observable only.

## Invariants

- Budget control enforces the 5-hour provider window only.
- 7-day usage never blocks a prompt or tool call.
- Global defaults come from environment variables.
- `/budget cap <percent>` changes only the current session; it does not change global config.
- Slash commands are never blocked by budget control.
- `ignore once` is consumed by the next non-command user prompt.
- Timed ignore bypasses until its deadline, then expires without another command.
- `off` persists in the session and announces itself on session start.
- Over cap blocks exec/write-class tools, not read/status commands.
- If usage cannot be read, the default policy blocks new spend unless `PI_BUDGET_FAIL_OPEN=1` is set.
- When a session cap is active, warning is derived as `cap - 2`.

## Contracts

- Usage source: `omp usage --json --provider <provider>`.
- Default provider: `openai-codex`.
- Default window: `5h`.
- Global default cap: 20% used.
- Global default warning: 18% used.
- Session cap override: stored in session state; reset returns to the global default.
- Session state store: OMP custom entries with `customType = "pi-budget-control"`.
