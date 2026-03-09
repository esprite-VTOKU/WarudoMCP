# Phase 1: MCP Server Foundation - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

A running MCP server that connects to Warudo over WebSocket (port 19053) and REST (port 19052), speaks stdio JSON-RPC, and handles connection failures gracefully. No scene inspection or asset control tools — just the transport skeleton and connection management.

</domain>

<decisions>
## Implementation Decisions

### Connection lifecycle
- Lazy connection — connect to Warudo on first tool call, not at server start
- Server starts successfully even if Warudo isn't running yet
- Connection is established (or re-established) when a tool is actually called

### Claude's Discretion
- Configuration approach (env vars, MCP client args, or both) — use whatever is most standard for MCP servers
- Default host/port values (ws://localhost:19053, http://localhost:19052 are sensible defaults)
- Error detail level — Claude decides between actionable vs simple errors
- Whether to translate Warudo errors or pass them through
- npm package name and MCP server registration name
- Project structure and file organization
- Error recovery behavior when Warudo disconnects mid-session

</decisions>

<specifics>
## Specific Ideas

- Warudo WebSocket API is on port 19053 with documented actions: `setEntityDataInputPortValue`, `invokeEntityTriggerPort`, `sendPluginMessage`
- Warudo REST API is on port 19052 with endpoints: GET /api/about, GET /api/scenes, PUT /api/openedScene
- User has an existing Warudo SDK reference skill (github.com/esprite-VTOKU/warudo-plugin-skill) documenting the full protocol
- Architecture should support future Warudo C# plugin reusing tool definitions
- User prefers to let Claude handle most implementation details — trusts builder judgment

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- User's OBSBOT mod shows familiarity with Warudo's Node/Asset system, network protocols, and real-time patterns
- User's SDK reference documents all WebSocket actions and REST endpoints

### Integration Points
- MCP SDK v1 (`@modelcontextprotocol/sdk` ^1.27.x) for server framework
- `ws` ^8.19.x for WebSocket client to Warudo
- Zod 3.25+ for tool input schemas
- Node.js 22 LTS as runtime target

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-mcp-server-foundation*
*Context gathered: 2026-03-09*
