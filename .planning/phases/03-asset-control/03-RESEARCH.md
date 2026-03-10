# Phase 3: Asset Control - Research

**Researched:** 2026-03-09
**Status:** Complete
**Confidence:** HIGH

## Phase Goal

AI assistants can modify Warudo scene state -- setting asset properties, triggering actions, and communicating with plugins.

## Technical Findings

### WebSocket Actions for Mutations

The three Warudo WebSocket actions needed are well-documented in the SDK reference:

1. **`setEntityDataInputPortValue`** — Sets a data input port value on any entity
   - Parameters: `{ entityId: string, portKey: string, value: unknown, broadcast?: boolean }`
   - `broadcast` controls whether the change is sent to other connected clients (default behavior TBD)
   - Confidence: HIGH

2. **`invokeEntityTriggerPort`** — Invokes a trigger port on any entity/node
   - Parameters: `{ entityId: string, portKey: string }`
   - Trigger ports are fire-and-forget (no value to set)
   - Confidence: HIGH

3. **`sendPluginMessage`** — Sends a message to a Warudo plugin
   - Parameters: `{ pluginId: string, action: string, payload?: unknown }`
   - Plugin must be loaded and listening for the specified action
   - Confidence: HIGH

### Existing Infrastructure

The codebase already has everything needed for mutation tools:

- **`wsClient.send()`** — Sends any WebSocket message and waits for response (10s timeout with requestId correlation)
- **`wsClient.ensureConnected()`** — Lazy connection pattern
- **`warudoError()`** — MCP error response helper
- **`server.tool()`** — MCP tool registration with Zod schemas
- **Zod** — Already a dependency for input validation

### Tool Design Considerations

**Generic vs. Specific:**
- CONTEXT.md gives Claude's discretion on whether to add convenience wrappers
- Recommendation: Start with 3 generic tools matching the 3 WebSocket actions exactly
- Convenience wrappers can be added in v2 (CTRL-04, CTRL-05, CTRL-06)
- Current tool count: 6 (Phase 1: 2, Phase 2: 4). Adding 3 brings it to 9, well within the 8-15 target

**Response Format:**
- Mutation tools should confirm what was changed (echo back the entityId, portKey, and value)
- For trigger invocations, confirm the trigger was sent (no return value from Warudo expected)
- For plugin messages, confirm the message was sent with the pluginId and action

**Error Cases:**
- Invalid entityId: Warudo may return an error in the WebSocket response; we should check for error fields
- Invalid portKey: Similar error handling
- Invalid value type: Zod schema validation catches type mismatches before sending
- Plugin not loaded: Warudo may return error or silently drop the message
- Follow established pattern: return `warudoError()` with actionable suggestions (e.g., "use list_assets to find valid entity IDs")

### Testing Strategy

- Unit tests for input validation and response formatting (same pattern as scene-tools.test.ts)
- Cannot integration-test against actual Warudo in CI
- Test helpers that mirror the formatting logic from tool handlers
- Verify TypeScript compilation with `npx tsc --noEmit`

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebSocket action names differ from docs | LOW | HIGH | Defensive error messages suggesting check_connection |
| Response format for mutations differs | LOW | MEDIUM | Log unexpected response keys to stderr |
| broadcast parameter behavior unclear | MEDIUM | LOW | Default to not sending it; let Warudo use its default |
| Value type mismatches for ports | MEDIUM | MEDIUM | Accept `unknown` via Zod and let Warudo validate |

## Recommendations for Planning

1. **Single plan** is sufficient — all 3 tools follow the same pattern (WebSocket send + response formatting) and can be implemented together
2. All 3 tools register in `src/index.ts` following the existing inline pattern (tool count still under 8 refactor threshold after adding 3)
3. Tests go in a new `src/__tests__/control-tools.test.ts` file
4. No new files needed beyond the test file — tools register inline in index.ts, types can extend existing types.ts if needed

## RESEARCH COMPLETE
