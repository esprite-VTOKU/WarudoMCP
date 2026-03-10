---
phase: 03-asset-control
plan: 01
status: complete
started: "2026-03-09"
completed: "2026-03-09"
duration: "3 min"
---

# Plan 03-01: Asset Mutation Tools

## What Was Built

Three new MCP tools for modifying Warudo scene state:

1. **set_data_input** — Sets a data input port value on any asset/node via `setEntityDataInputPortValue` WebSocket action
2. **invoke_trigger** — Invokes a trigger port on any asset/node via `invokeEntityTriggerPort` WebSocket action
3. **send_plugin_message** — Sends a message to a Warudo plugin via `sendPluginMessage` WebSocket action

All tools follow established patterns: Zod input validation, `wsClient.ensureConnected()`, error response checking, `warudoError()` with actionable suggestions, and `formatPortValue()` for display formatting.

## Key Files

### Created
- `src/__tests__/control-tools.test.ts` — 15 tests covering response formatting and error detection for all 3 tools

### Modified
- `src/index.ts` — Added 3 new tool registrations after Phase 2 tools section

## Self-Check: PASSED

- [x] TypeScript compiles cleanly (`npx tsc --noEmit`)
- [x] All 51 tests pass (`npx vitest run`)
- [x] set_data_input sends setEntityDataInputPortValue with entityId, portKey, value
- [x] invoke_trigger sends invokeEntityTriggerPort with entityId, portKey
- [x] send_plugin_message sends sendPluginMessage with pluginId, pluginAction, payload
- [x] All tools check response for error/Error fields
- [x] All tools return warudoError() on failure with actionable suggestions
- [x] All tools use wsClient.ensureConnected() before sending
- [x] No console.log in source files (only console.error)
- [x] Total tool count: 9 (2 Phase 1 + 4 Phase 2 + 3 Phase 3)

## Decisions

- [03-01]: Used `pluginAction` field name in sendPluginMessage to avoid collision with WebSocket protocol's `action` field. May need adjustment when testing against live Warudo instance.
- [03-01]: All three tools are generic (matching SDK actions exactly), no convenience wrappers — keeps tool count low and follows CONTEXT.md discretion.
- [03-01]: Error detection checks both `error` and `Error` fields in WebSocket response for defensive handling.

## Deviations

None. Implementation followed the plan exactly.
