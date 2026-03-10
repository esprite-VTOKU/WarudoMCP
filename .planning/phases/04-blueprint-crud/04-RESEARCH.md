# Phase 4: Blueprint CRUD - Research

**Researched:** 2026-03-09
**Domain:** Warudo Blueprint/Graph Management via MCP
**Confidence:** MEDIUM

## Summary

Warudo blueprints (called "graphs" in the codebase) are managed through C# APIs on the runtime side -- there are NO direct WebSocket or REST API endpoints for blueprint CRUD operations. The existing external APIs (WebSocket port 19053, REST port 19052) only expose entity data control (`setEntityDataInputPortValue`, `invokeEntityTriggerPort`), plugin messaging (`sendPluginMessage`), and basic scene queries (`getScene`, REST `/api/about`, `/api/scenes`).

This means Phase 4 must take one of two approaches: (1) use the `getScene` WebSocket action to read graph data from the scene JSON (which contains both assets and graphs), and use `Context.Service.ImportGraph(json)` via a bridge mechanism for creation, or (2) accept that blueprint creation requires a companion Warudo plugin. Given the MCP server's existing architecture and the `sendPluginMessage` tool already available, the recommended approach is a **hybrid strategy**: read graphs from the scene JSON via `getScene`, and for creation/mutation, either use JSON import via the existing WebSocket protocol or document that a companion plugin is needed.

**Primary recommendation:** Use `getScene` to list graphs (the scene JSON includes a `graphs` array alongside `assets`). For graph creation, construct blueprint JSON on the MCP side and send it via `sendPluginMessage` to a lightweight companion plugin that calls `Context.Service.ImportGraph()` and `Context.OpenedScene.RemoveGraph()`. This is the most reliable approach given Warudo's architecture.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(None -- all decisions are at Claude's discretion for this phase)

### Claude's Discretion
- Tool design for blueprint CRUD -- Claude decides exact tool signatures, parameter schemas, and how graph structure is represented in MCP tool parameters
- Whether to use a single `create_blueprint` tool that accepts a full graph definition, or break into multiple tools (create_graph, add_node, add_connection) -- consider tool count budget (9 tools now, 8-15 target)
- How to discover available node types -- may need a `list_node_types` tool or similar for AI to know what nodes exist
- Graph creation approach -- whether to use Warudo's Graph API via WebSocket actions (preferred if available) or JSON import (documented as "hacky and not recommended" per Warudo docs)
- Response format for blueprint operations -- what to return after creation/modification
- Error handling for invalid node types, connection mismatches, and graph validation -- follow established `warudoError()` patterns
- How to represent node connections in tool parameters (data connections vs flow connections are distinct in Warudo)
- Blueprint identification -- by name, ID, or index for lifecycle operations

### Deferred Ideas (OUT OF SCOPE)
None -- auto mode, discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BPRT-01 | User can create new blueprint graphs with specified nodes and connections | Graph JSON structure research, ImportGraph API, AddNode/AddFlowConnection/AddDataConnection patterns, sendPluginMessage bridge approach |
| BPRT-02 | User can list, enable, disable, and remove existing blueprint graphs | getScene response includes graphs array, graph properties (Name, Enabled, Id), RemoveGraph API via plugin bridge |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ws | ^8.19.0 | WebSocket client (already in project) | Existing dependency, used for all Warudo communication |
| zod | ^3.25.76 | Schema validation for tool params (already in project) | Existing dependency, used for all MCP tool schemas |
| @modelcontextprotocol/sdk | ^1.27.1 | MCP server framework (already in project) | Existing dependency |

### Supporting
No new dependencies needed. All blueprint operations use existing WebSocket and REST clients.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── index.ts                    # MCP server + tool registration (growing, may refactor)
├── tools/                      # NEW: Extract tools to separate files if index.ts too large
│   └── blueprint-tools.ts      # Blueprint CRUD tool implementations
├── warudo/
│   ├── websocket-client.ts     # Existing WebSocket client
│   ├── rest-client.ts          # Existing REST client
│   ├── types.ts                # Existing types + new graph types
│   └── graph-builder.ts        # NEW: Graph JSON construction utilities
├── config.ts                   # Existing config
└── errors.ts                   # Existing error helpers
```

### Pattern 1: Scene JSON Graph Extraction
**What:** The `getScene` WebSocket action returns scene JSON containing both `assets` and `graphs` arrays. Graphs can be read from this response just like assets are currently read in `list_assets`.
**When to use:** For listing and inspecting existing blueprints (BPRT-02 read operations).
**Confidence:** MEDIUM -- scene JSON structure for graphs is inferred from docs stating "A scene is a JSON file that stores a list of assets, a list of blueprints, and plugin settings."

### Pattern 2: Graph JSON Construction + Import
**What:** Build a graph JSON structure on the MCP side matching Warudo's internal format, then send it to Warudo for import. Two sub-approaches:
- **ImportGraph approach:** Send the JSON string to Warudo via `sendPluginMessage` to a companion plugin that calls `Context.Service.ImportGraph(json)`. Docs note this is "rather hacky" but functional.
- **Plugin bridge approach:** A companion Warudo plugin receives structured messages via `sendPluginMessage` and uses the proper C# Graph API (`new Graph()`, `AddNode<T>()`, `AddFlowConnection()`, `AddDataConnection()`) to build graphs programmatically.
**When to use:** For graph creation (BPRT-01).
**Confidence:** MEDIUM -- ImportGraph works but is officially described as hacky.

### Pattern 3: Entity Control for Graph Lifecycle
**What:** Graphs are entities in the scene. If graph entity IDs are discoverable via `getScene`, existing tools (`set_data_input` for enabling/disabling via an `Enabled` property, or a dedicated tool) may partially work for lifecycle management.
**When to use:** For enable/disable operations (BPRT-02 mutation operations).
**Confidence:** LOW -- need to verify if graphs respond to `setEntityDataInputPortValue` for the `Enabled` field.

### Anti-Patterns to Avoid
- **Direct JSON file manipulation:** Do not try to modify Warudo scene files directly on disk. Warudo manages scene state in memory.
- **Assuming REST API has graph endpoints:** REST API is limited to `/api/about`, `/api/scenes`, `/api/openedScene`. No blueprint endpoints exist.
- **Building a full visual node editor:** This is an MCP server for AI, not a GUI. Keep graph representation as structured data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph JSON format | Custom serialization | Match Warudo's internal format via research/testing | Format must match exactly for ImportGraph to work |
| Node type discovery | Hardcoded node type list | Read from scene JSON or provide common types as documentation | Node types are extensible via plugins |
| UUID generation | Custom ID generator | Node.js `crypto.randomUUID()` | Built-in, matches GUID format Warudo expects |

## Common Pitfalls

### Pitfall 1: No Direct External API for Graph CRUD
**What goes wrong:** Assuming WebSocket actions exist for creating/removing graphs (like `createGraph`, `removeGraph`). They don't.
**Why it happens:** The existing tools use `getScene`, `setEntityDataInputPortValue`, `invokeEntityTriggerPort`, and `sendPluginMessage` -- it's natural to assume similar actions exist for graphs.
**How to avoid:** Accept the architectural reality. Graph creation either needs ImportGraph (hacky) or a companion plugin. Design tools that clearly communicate this to the AI user.
**Warning signs:** Tools that try to send unsupported WebSocket actions and get no response or errors.

### Pitfall 2: Graph JSON Format Uncertainty
**What goes wrong:** Constructing graph JSON that doesn't match Warudo's expected format, causing ImportGraph to fail silently or crash.
**Why it happens:** The graph JSON format is not publicly documented in detail.
**How to avoid:** Design the create_blueprint tool to accept a high-level graph description and construct JSON carefully. Include validation. Consider a "dry run" mode that returns the JSON without importing.
**Warning signs:** ImportGraph calls that succeed but produce broken blueprints.

### Pitfall 3: Graph Identification Mismatch
**What goes wrong:** Using graph names for identification but multiple graphs can have the same name.
**Why it happens:** Warudo identifies graphs by GUID internally but displays them by name.
**How to avoid:** Always use graph ID (GUID) as primary identifier, with name as display only. Return IDs from list operations so subsequent operations can use them.

### Pitfall 4: Missing BroadcastOpenedScene
**What goes wrong:** Graph is created/modified programmatically but the editor doesn't reflect changes.
**Why it happens:** Warudo requires explicit `Context.Service.BroadcastOpenedScene()` after graph mutations.
**How to avoid:** Ensure any companion plugin calls `BroadcastOpenedScene()` after every graph mutation.

## Code Examples

### Reading Graphs from Scene JSON (inferred from existing list_assets pattern)
```typescript
// In the list_blueprints tool handler
const response = await wsClient.send({ action: "getScene" });
const resp = response as Record<string, unknown>;

// Graphs may be at resp.graphs, resp.data.graphs, or resp.blueprints
let rawGraphs: unknown[] | undefined;
if (Array.isArray(resp.graphs)) {
  rawGraphs = resp.graphs;
} else if (resp.data && typeof resp.data === "object") {
  const data = resp.data as Record<string, unknown>;
  if (Array.isArray(data.graphs)) {
    rawGraphs = data.graphs;
  }
}
// Also try "blueprints" as an alternative key
if (!rawGraphs && Array.isArray(resp.blueprints)) {
  rawGraphs = resp.blueprints;
}
```

### Graph JSON Structure (inferred from C# API)
```typescript
interface WarudoGraphJson {
  Id: string;        // GUID
  Name: string;
  Enabled: boolean;
  Nodes: WarudoNodeJson[];
  FlowConnections: WarudoConnectionJson[];
  DataConnections: WarudoConnectionJson[];
}

interface WarudoNodeJson {
  Id: string;        // GUID
  TypeId: string;    // Node type GUID or type name
  GraphPosition: { X: number; Y: number };
  DataInputs: Record<string, unknown>;
}

interface WarudoConnectionJson {
  SourceNodeId: string;
  SourcePort: string;
  DestNodeId: string;
  DestPort: string;
}
```

### Sending Graph to Companion Plugin
```typescript
// Via sendPluginMessage (existing tool)
await wsClient.send({
  action: "sendPluginMessage",
  pluginId: "warudo-mcp-bridge",
  pluginAction: "importGraph",
  payload: { graphJson: JSON.stringify(graphDefinition) }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON ImportGraph only | C# Graph API (AddNode, AddFlowConnection, AddDataConnection) | Warudo SDK update | Programmatic graph construction is now the recommended approach, but requires C# plugin code |

**Key insight:** The "hacky" JSON import is the ONLY way to create graphs from external apps without a companion plugin. The proper Graph API (`new Graph()`, `AddNode<T>()`, etc.) is only accessible from C# code running inside Warudo.

## Open Questions

1. **Scene JSON graph format**
   - What we know: Scene JSON contains assets and graphs. Assets are accessible via `getScene`.
   - What's unclear: Exact field names for graphs in the `getScene` response (is it `graphs`, `blueprints`, or something else?)
   - Recommendation: Implement defensively with multiple field name fallbacks (same pattern as existing asset handling). Test against running Warudo.

2. **Graph entity control via existing WebSocket actions**
   - What we know: `setEntityDataInputPortValue` works on assets. Graphs are entities too.
   - What's unclear: Whether `setEntityDataInputPortValue` can target graph entities (e.g., set `Enabled` field on a graph by its entity ID).
   - Recommendation: Try it -- if graphs are entities in the same entity system, existing mutation tools may work for enable/disable. If not, need companion plugin.

3. **ImportGraph JSON format**
   - What we know: `Context.Service.ImportGraph(fileContents)` accepts a JSON string representing a graph.
   - What's unclear: Exact JSON schema. The format "may change in future versions" per docs.
   - Recommendation: Design the create_blueprint tool to accept structured input and construct JSON. Include the JSON in the response for debugging. Accept that format may need updating.

4. **Companion plugin requirement**
   - What we know: Full graph CRUD requires C# API calls (AddGraph, RemoveGraph, etc.)
   - What's unclear: Whether we should ship a companion plugin as part of this MCP server.
   - Recommendation: Phase 4 should work WITHOUT requiring a companion plugin by using the getScene + ImportGraph approach. Document the companion plugin approach as an enhancement for Phase 5 or v2. For removal/enable/disable, try using `setEntityDataInputPortValue` on graph entities first.

## Tool Design Recommendation

Given the tool count constraint (currently 9, target 8-15), recommend **3 new tools** for Phase 4:

1. **`list_blueprints`** -- List all blueprint graphs in the scene (name, ID, enabled status, node count)
2. **`create_blueprint`** -- Create a new blueprint graph with specified nodes, data connections, and flow connections. Accepts a structured graph definition.
3. **`manage_blueprint`** -- Enable, disable, or remove a blueprint by ID. Single tool with `action` parameter to avoid tool count explosion.

This brings the total to **12 tools** (within the 8-15 target).

Alternative considered: Separate `enable_blueprint`, `disable_blueprint`, `remove_blueprint` tools (would bring count to 14). Rejected because the operations are simple and can share a tool.

## Sources

### Primary (HIGH confidence)
- [Warudo Generating Blueprints docs](https://docs.warudo.app/docs/scripting/api/generating-blueprints) - Graph API, ImportGraph, AddNode, AddFlowConnection
- [Warudo Scene API docs](https://docs.warudo.app/docs/scripting/api/scene) - GetGraphs, AddGraph, RemoveGraph
- [Warudo Ports & Triggers docs](https://docs.warudo.app/docs/scripting/api/ports-and-triggers) - DataInput, DataOutput, FlowInput, FlowOutput attributes
- [Warudo Nodes docs](https://docs.warudo.app/docs/scripting/api/nodes) - Node type system, NodeType attribute
- [esprite-VTOKU/warudo-plugin-skill graph-api.md](https://github.com/esprite-VTOKU/warudo-plugin-skill) - BuildBlueprintGraph pattern, RemoveBlueprintGraph, port key naming conventions, graph construction order
- [esprite-VTOKU/warudo-plugin-skill sdk-reference.md](https://github.com/esprite-VTOKU/warudo-plugin-skill) - External control interfaces, scene/graph management, "Graph control is code-only"

### Secondary (MEDIUM confidence)
- [Warudo API Overview](https://docs.warudo.app/docs/scripting/api/overview) - WebSocket architecture between editor and runtime
- [Steam discussion on Blueprint REST API](https://steamcommunity.com/app/2079120/discussions/0/3812908540893823781/) - Developer confirmation that HTTP/Webhook nodes are not yet implemented

### Tertiary (LOW confidence)
- Scene JSON graph field names (inferred, not verified against running Warudo)
- Whether `setEntityDataInputPortValue` works on graph entities (untested hypothesis)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, uses existing project infrastructure
- Architecture: MEDIUM - graph JSON format and getScene response structure for graphs are inferred
- Pitfalls: HIGH - well-documented limitations in Warudo's external API surface

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (30 days -- Warudo API is relatively stable)
