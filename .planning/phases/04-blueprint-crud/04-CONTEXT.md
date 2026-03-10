# Phase 4: Blueprint CRUD - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

MCP tools for creating blueprint graphs with specified nodes and connections, listing existing blueprint graphs in the scene, and managing their lifecycle (enable, disable, remove). Natural language generation is Phase 5 — this phase provides the raw graph construction and management primitives.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Tool design for blueprint CRUD — Claude decides exact tool signatures, parameter schemas, and how graph structure is represented in MCP tool parameters
- Whether to use a single `create_blueprint` tool that accepts a full graph definition, or break into multiple tools (create_graph, add_node, add_connection) — consider tool count budget (9 tools now, 8-15 target)
- How to discover available node types — may need a `list_node_types` tool or similar for AI to know what nodes exist
- Graph creation approach — whether to use Warudo's Graph API via WebSocket actions (preferred if available) or JSON import (documented as "hacky and not recommended" per Warudo docs)
- Response format for blueprint operations — what to return after creation/modification
- Error handling for invalid node types, connection mismatches, and graph validation — follow established `warudoError()` patterns
- How to represent node connections in tool parameters (data connections vs flow connections are distinct in Warudo)
- Blueprint identification — by name, ID, or index for lifecycle operations

</decisions>

<specifics>
## Specific Ideas

- Warudo Graph API (from SDK reference): `new Graph()`, `AddNode<T>()`, `AddDataConnection(sourceNode, sourcePort, destNode, destPort)`, `AddFlowConnection(sourceNode, sourcePort, destNode, destPort)`
- Warudo node system uses `[NodeType]`, `[AssetType]`, `[DataInput]`, `[DataOutput]`, `[Trigger]`, `[FlowOutput]` attributes
- WebSocket actions may include graph-related operations — research needed to map C# API to WebSocket equivalents
- Requirements BPRT-01 (create graphs) and BPRT-02 (list/enable/disable/remove) both in this phase
- Blueprint work split from Intelligence (Phase 5) because NL generation depends on stable graph creation primitives
- STATE.md concern: "Blueprint JSON import: Warudo docs call the format 'hacky and not recommended' — need to verify viability in Phase 4"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WarudoWebSocketClient.send()` — sends WebSocket messages to Warudo, used by all existing tools
- `WarudoRestClient` — REST API client, may have relevant endpoints for graph operations
- `warudoError()` — MCP error helper for structured error responses
- `formatPortValue()` — value formatting/truncation utility in index.ts
- Existing tool registration pattern in `src/index.ts`

### Established Patterns
- Tool registration via `server.tool(name, desc, zodSchema, handler)`
- Lazy connection with `wsClient.ensureConnected()`
- Defensive response parsing with multiple field name fallbacks
- Error responses with actionable guidance (suggesting next tool to try)
- Inline tool registration in index.ts (refactor consideration at >8 tools — now at 9)

### Integration Points
- New tools register in `src/index.ts` alongside Phase 1-3 tools
- Use same `wsClient` instance for WebSocket graph operations
- May need new WebSocket actions beyond what's been used (getScene, setEntityDataInputPortValue, invokeEntityTriggerPort, sendPluginMessage)
- Tool count will reach 12-15 range — may want to refactor tools into separate files per phase

</code_context>

<deferred>
## Deferred Ideas

None — auto mode, discussion stayed within phase scope

</deferred>

---

*Phase: 04-blueprint-crud*
*Context gathered: 2026-03-09*
