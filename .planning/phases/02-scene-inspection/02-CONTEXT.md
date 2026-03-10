# Phase 2: Scene Inspection - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Read-only MCP tools for querying Warudo scene state. Users can list assets, read asset properties, and get server info. No scene mutations — that's Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Tool granularity — Claude decides how to split tools (per-endpoint, coarse-grained, or hybrid). Research pitfall: keep total tool count manageable (8-15 across all phases).
- Response format — Claude decides how to structure asset data in tool responses. Should be useful for AI consumption (clear, parseable, not overwhelming).
- Asset filtering — Claude decides whether list_assets supports type filtering or returns everything. Consider what's most useful for AI assistants.
- Tool naming conventions — Claude picks names that are clear and consistent.
- Error messages for read-only operations — follow Phase 1 patterns (actionable errors with guidance).

</decisions>

<specifics>
## Specific Ideas

- Warudo WebSocket API actions available for scene inspection: need to discover what read-only queries the WebSocket supports
- Warudo REST API has: GET /api/about (version, plugins), GET /api/scenes (scene list)
- The WebSocket `setEntityDataInputPortValue` implies there's a way to GET values too — research needed
- User's SDK reference documents `Context.OpenedScene.GetAssetList()`, `GetAsset(guid)` — these are C# internal APIs, need to map to WebSocket equivalents

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WarudoWebSocketClient` (src/warudo/websocket-client.ts): Lazy connection, send/receive messages
- `WarudoRestClient` (src/warudo/rest-client.ts): GET /api/about, GET /api/scenes, PUT /api/openedScene
- `warudoError()` (src/errors.ts): MCP-compatible error responses
- `loadConfig()` (src/config.ts): Environment variable configuration

### Established Patterns
- Lazy connection on first tool call (from Phase 1)
- stderr-only logging (stdout reserved for MCP JSON-RPC)
- Tools registered via `server.tool(name, desc, zodSchema, handler)` pattern (from ping/check_connection)

### Integration Points
- New tools register in `src/index.ts` alongside existing ping and check_connection
- Tools use existing `wsClient` and `restClient` instances
- Error handling follows `warudoError()` pattern

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-scene-inspection*
*Context gathered: 2026-03-09*
