# 0002. Raise the default 5-hour budget cap

## Status

Accepted

## Context

The guard enforces the provider's rolling 5-hour usage window, not the usage created by one Pi or Oh My Pi session.

A 20% default made sense only if the reported usage could be treated as current-session spend. In practice, the reported percentage can include previous work inside the rolling window and concurrent sessions that use the same provider.

## Decision

The default 5-hour cap is 95% used.

The default warning threshold is 75% used.

Current-session cap overrides still apply only to the current session and still derive warning as `cap - 2`.

## Consequences

- Default behavior now avoids blocking normal sessions because earlier 5-hour usage already exceeded 20%.
- The guard still prevents running the provider window to exhaustion by default.
- Users who want a stricter absolute-window policy can set `PI_BUDGET_CAP_PERCENT` and `PI_BUDGET_WARN_PERCENT`.
- Per-session spend attribution remains out of scope until the plugin records a usage baseline at session start.
