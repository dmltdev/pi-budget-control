# 0001. Enforce the 5-hour provider usage window

## Status

Accepted

## Context

OMP reports multiple provider usage windows. OpenAI Codex exposes a short 5-hour window and a longer 7-day window. A single cap percentage over both windows is confusing because a normal 1-day burst can consume a large share of the 7-day window without meaning the current session should stop.

## Decision

Budget control enforces only the 5-hour provider window by default.

The 7-day window remains outside plugin policy. Users can observe it with `omp usage`, Codexbar, or another status surface.

## Consequences

- Session behavior is easy to explain: stop at 20% of the current 5-hour window.
- The plugin avoids inventing weekly-budget semantics.
- A user can still overspend the 7-day window across several allowed 5-hour sessions.
- Weekly control would need a separate policy model, not a second default threshold.
