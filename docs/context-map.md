# Context map

## Budget control

Owns budget policy, bypass state, command handling, and prompt/tool blocking.

## Harness provider usage

Upstream published language from `omp usage --json` or `pi usage --json`. Budget control reads provider usage limits and treats only `scope.windowId = "5h"` as enforceable.

Relationship: conformist. The plugin does not reinterpret harness-reported percentages.

## Harness session runtime

Upstream runtime from Pi or Oh My Pi that emits extension events and persists custom entries. Budget control stores session-local state as custom entries and reacts to `input`, `tool_call`, `agent_end`, and `session_start` events.

Relationship: plugin. The runtime owns execution. Budget control can block user input and selected tool calls.
