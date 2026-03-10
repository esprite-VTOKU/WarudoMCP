# Phase 3: Asset Control - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Mutation tools for modifying Warudo scene state — setting asset data input values, invoking trigger ports, and sending plugin messages. Read-only tools already exist from Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Tool design for set_data_input, invoke_trigger, send_plugin_message — Claude decides exact tool signatures and parameter schemas
- Whether to add convenience wrappers (e.g., `set_expression` as sugar over `set_data_input`) or keep it generic
- Error handling for invalid entity IDs, port keys, or values — follow established patterns from Phase 1-2
- Response format for mutation confirmations — what to return after a successful set/invoke

</decisions>

<specifics>
## Specific Ideas

- Warudo WebSocket actions from SDK reference:
  - `setEntityDataInputPortValue`: { entityId, portKey, value, broadcast }
  - `invokeEntityTriggerPort`: { entityId, portKey }
  - `sendPluginMessage`: { pluginId, action, payload }
- These map directly to the 3 requirements (CTRL-01, CTRL-02, CTRL-03)
- User prefers full discretion on implementation details

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WarudoWebSocketClient.send()` — sends WebSocket messages to Warudo
- `WarudoRestClient` — available but likely not needed for mutations
- `warudoError()` — MCP error helper
- Existing tool registration pattern in `src/index.ts`

### Established Patterns
- Tool registration via `server.tool(name, desc, zodSchema, handler)`
- Lazy connection with `wsClient.ensureConnected()`
- Error responses with `warudoError()`
- Zod schemas for input validation

### Integration Points
- New tools register in `src/index.ts` alongside Phase 1-2 tools
- Use same `wsClient` instance for WebSocket mutations
- Follow same response structure patterns

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-asset-control*
*Context gathered: 2026-03-09*
