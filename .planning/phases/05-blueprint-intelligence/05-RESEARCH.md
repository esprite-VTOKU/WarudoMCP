# Phase 5: Blueprint Intelligence - Research

**Researched:** 2026-03-09
**Domain:** Natural language to Warudo blueprint generation via MCP context enrichment
**Confidence:** HIGH

## Summary

Phase 5 is fundamentally a **context enrichment** phase, not a code-heavy feature phase. The AI assistant (Claude) IS the language model — it already understands natural language. What it lacks is knowledge of Warudo's node type catalog, port schemas, and connection rules. Phase 5 provides that knowledge through a `list_node_types` tool (querying Warudo's runtime for available nodes) and an MCP resource (`warudo://node-catalog`) containing a curated reference of common node types with their ports and connection patterns.

The `create_blueprint` tool from Phase 4 already accepts structured `CreateBlueprintInput` with nodes, dataConnections, and flowConnections. Phase 5 does NOT need a new `generate_blueprint` tool — the AI client reasons from the node catalog + user intent and calls `create_blueprint` directly. This keeps the architecture clean: tools do actions, resources provide knowledge.

**Primary recommendation:** Add a `list_node_types` tool that queries Warudo for available node types, plus a static MCP resource with curated node type documentation (common nodes, their ports, connection patterns). The AI uses these to inform its `create_blueprint` calls.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation decisions are at Claude's discretion for this phase.

### Claude's Discretion
- How to represent the Warudo node type catalog — whether as an MCP resource, a static JSON file bundled with the server, or inline tool descriptions
- Whether to add a `generate_blueprint` tool that wraps `create_blueprint` with NL understanding, or rely on the AI client's own reasoning to call `create_blueprint` with the right parameters
- Node type discovery approach — a `list_node_types` tool that queries Warudo for available node types and their port schemas, so the AI knows what building blocks exist
- How to provide connection rules and port compatibility info to the AI — embedded in tool descriptions, separate reference tool, or MCP resources
- Validation strategy — whether to validate generated blueprints before sending to Warudo (check node type existence, port compatibility) or let Warudo reject invalid graphs
- How to handle ambiguous NL descriptions — whether the tool itself asks clarifying questions or returns structured "needs clarification" responses
- Error recovery for invalid blueprints — whether to attempt auto-fix (e.g., suggest alternative node types) or return the error with guidance
- Template/pattern system — whether to include common blueprint patterns (e.g., "on key press do action") as built-in templates the AI can reference

### Deferred Ideas (OUT OF SCOPE)
None — auto mode, discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BPRT-03 | User can generate blueprints from natural language descriptions of desired behavior | list_node_types tool provides runtime discovery, MCP resource provides curated node catalog with ports/patterns, enhanced create_blueprint description guides AI reasoning |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.27.1 | MCP server, tool + resource registration | Already in project, supports server.resource() API |
| zod | ^3.25.76 | Tool parameter schemas | Already in project |
| ws | ^8.19.0 | WebSocket client to Warudo | Already in project |

### Supporting
No new libraries needed. Phase 5 is pure logic built on existing dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MCP resource for catalog | Inline in tool descriptions | Tool descriptions have character limits; resource allows full catalog |
| list_node_types tool | Static JSON only | Runtime query discovers user-installed plugin nodes; static only covers built-in |
| AI-driven create_blueprint | New generate_blueprint tool | Adding a wrapper tool adds complexity without value — the AI IS the NL engine |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── tools/
│   ├── blueprint-tools.ts       # Existing (Phase 4)
│   └── node-catalog-tools.ts    # NEW: list_node_types handler + helpers
├── resources/
│   └── node-catalog.ts          # NEW: MCP resource with curated node reference
├── warudo/
│   ├── websocket-client.ts      # Existing
│   ├── rest-client.ts           # Existing
│   └── types.ts                 # Extended with node type interfaces
├── index.ts                     # Extended with new tool + resource registration
└── ...
```

### Pattern 1: MCP Resource for Static Reference Data
**What:** Use `server.resource()` to expose a curated node catalog as a readable resource
**When to use:** When the AI needs reference data that doesn't change during a session
**Example:**
```typescript
server.resource(
  "node-catalog",
  "warudo://node-catalog",
  { description: "Warudo node type catalog with ports and connection patterns" },
  async () => ({
    contents: [{ uri: "warudo://node-catalog", text: catalogText, mimeType: "text/markdown" }]
  })
);
```

### Pattern 2: Runtime Discovery Tool
**What:** `list_node_types` queries Warudo via WebSocket for available node types
**When to use:** When the user has plugins installed that add custom nodes
**Example:** Send `getScene` and extract unique node typeIds from all graphs, or use a dedicated WebSocket action if available

### Pattern 3: Enhanced Tool Descriptions
**What:** Enrich `create_blueprint` tool description with connection patterns and common node examples
**When to use:** Always — tool descriptions are the primary way AI clients understand tool capabilities

### Anti-Patterns to Avoid
- **generate_blueprint wrapper tool:** Adds a layer between the AI's reasoning and `create_blueprint`. The AI already IS the NL processor — it just needs context.
- **Enormous tool descriptions:** Don't put the entire node catalog in tool descriptions. Use MCP resources for large reference data.
- **Client-side validation only:** Don't try to replicate Warudo's full validation logic. Let Warudo reject invalid graphs and return actionable errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NL understanding | Custom NLP parser | AI client's built-in reasoning | The AI client IS the language model |
| Node catalog hosting | Custom API endpoint | MCP resource API | MCP resources are the standard for static reference data |
| Blueprint validation | Full graph validator | Warudo's own validation + actionable error messages | Warudo knows its own rules better; partial validation gives false confidence |

**Key insight:** Phase 5 is about context enrichment, not building AI capabilities. The AI already understands language — it just needs to know what Warudo nodes exist and how they connect.

## Common Pitfalls

### Pitfall 1: Over-engineering the NL Layer
**What goes wrong:** Building a `generate_blueprint` tool with internal prompt engineering, when the AI client already does this
**Why it happens:** Treating the MCP server as the "smart" layer instead of the tool layer
**How to avoid:** Keep tools dumb — they do actions. Let the AI client be smart.
**Warning signs:** Tool handlers containing natural language processing logic

### Pitfall 2: Incomplete Node Discovery
**What goes wrong:** Only providing built-in node types, missing plugin-installed nodes
**Why it happens:** Relying only on static catalog without runtime query
**How to avoid:** Combine static catalog (common patterns) with runtime discovery (list_node_types)
**Warning signs:** AI suggests node types that exist in catalog but not in user's Warudo

### Pitfall 3: Port Name Guessing
**What goes wrong:** AI generates connections with wrong port names (e.g., "output" vs "Exit")
**Why it happens:** Port names aren't documented in the tool description
**How to avoid:** Include port names in the node catalog resource, and list_node_types should return port info
**Warning signs:** Warudo rejecting blueprints with "port not found" errors

### Pitfall 4: Tool Count Creep
**What goes wrong:** Adding too many tools (exceeding the 8-15 target)
**Why it happens:** Creating separate tools for node lookup, port lookup, validation, etc.
**How to avoid:** Currently 12 tools. Add at most 1 new tool (list_node_types) + 1 MCP resource. Final count: 13 tools.
**Warning signs:** More than 15 tools registered

## Code Examples

### MCP Resource Registration (from @modelcontextprotocol/sdk)
```typescript
// server.resource(name, uri, metadata, handler)
server.resource(
  "node-catalog",
  "warudo://node-catalog",
  { description: "Reference catalog of Warudo node types, ports, and connection patterns for blueprint generation" },
  async () => ({
    contents: [{
      uri: "warudo://node-catalog",
      text: NODE_CATALOG_MARKDOWN,
      mimeType: "text/markdown"
    }]
  })
);
```

### Node Type Extraction from Scene
```typescript
// Extract unique node types from all graphs in a scene
function extractNodeTypes(sceneResponse: Record<string, unknown>): NodeTypeInfo[] {
  const graphs = extractGraphsFromScene(sceneResponse);
  if (!graphs) return [];

  const typeMap = new Map<string, { count: number; names: string[] }>();
  for (const g of graphs) {
    const graph = g as Record<string, unknown>;
    const nodes = (graph.Nodes ?? graph.nodes ?? []) as Record<string, unknown>[];
    for (const node of nodes) {
      const typeId = String(node.TypeId ?? node.typeId ?? "unknown");
      const name = String(node.Name ?? node.name ?? "");
      const entry = typeMap.get(typeId) ?? { count: 0, names: [] };
      entry.count++;
      if (name && !entry.names.includes(name)) entry.names.push(name);
      typeMap.set(typeId, entry);
    }
  }

  return Array.from(typeMap.entries()).map(([typeId, info]) => ({
    typeId,
    usageCount: info.count,
    exampleNames: info.names,
  }));
}
```

### Curated Node Catalog Content
```markdown
# Warudo Node Type Catalog

## Event Nodes (Triggers)
### OnKeyPressNode
- **TypeId:** `OnKeyPressNode` (or GUID)
- **Flow Outputs:** Exit
- **Data Inputs:** Key (string - key name like "Space", "A", "LeftShift")
- **Use for:** Triggering actions when a keyboard key is pressed

### OnUpdateNode
- **TypeId:** `OnUpdateNode`
- **Flow Outputs:** Exit
- **Data Outputs:** DeltaTime (float)
- **Use for:** Running logic every frame

## Action Nodes
### PlayAnimationNode
- **TypeId:** `PlayAnimationNode`
- **Flow Inputs:** Enter
- **Flow Outputs:** Exit
- **Data Inputs:** Character (entity ref), Animation (string), Speed (float), Layer (int)
- **Use for:** Playing animations on characters

### SetExpressionNode
- **TypeId:** `SetExpressionNode`
- **Flow Inputs:** Enter
- **Flow Outputs:** Exit
- **Data Inputs:** Character (entity ref), Expression (string), Weight (float)
- **Use for:** Changing character facial expressions

## Flow Control Nodes
### WaitNode
- **TypeId:** `WaitNode`
- **Flow Inputs:** Enter
- **Flow Outputs:** Exit
- **Data Inputs:** Duration (float, seconds)
- **Use for:** Adding delays between actions

## Common Patterns
### "When key pressed, do action"
1. OnKeyPressNode (Key: "Space") --[Exit->Enter]--> PlayAnimationNode (Animation: "wave")

### "Loop with delay"
1. OnUpdateNode --[Exit->Enter]--> WaitNode (Duration: 1.0) --[Exit->Enter]--> ActionNode
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded node GUIDs | Runtime node type discovery | Current phase | AI adapts to user's installed plugins |
| No AI guidance | MCP resource with node catalog | Current phase | AI can generate valid blueprints without user knowing node types |

## Open Questions

1. **Warudo node type query action**
   - What we know: `getScene` returns graphs with nodes that have TypeId fields
   - What's unclear: Whether Warudo has a dedicated action to list ALL available node types (not just those in use)
   - Recommendation: Use `getScene` to discover in-use node types, supplement with curated static catalog. If a `getNodeTypes` or similar action exists, use it.

2. **Port schema discovery**
   - What we know: Nodes in graphs have DataInputs objects showing current values
   - What's unclear: Whether Warudo exposes port schemas (what ports a node TYPE has, not just current values)
   - Recommendation: Curated catalog covers common nodes. For unknown nodes, the AI can inspect existing instances via `get_asset_details` pattern.

3. **Node TypeId format**
   - What we know: Some nodes use descriptive names (e.g., "OnKeyPressNode"), others use GUIDs
   - What's unclear: Whether Warudo accepts both formats in importGraph
   - Recommendation: Support both in the catalog; test with descriptive names first as they're more AI-friendly.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis (src/tools/blueprint-tools.ts, src/index.ts) — verified tool registration patterns, CreateBlueprintInput interface, buildGraphJson logic
- @modelcontextprotocol/sdk documentation — server.resource() API for MCP resources
- Warudo SDK reference (github.com/esprite-VTOKU/warudo-plugin-skill) — node type patterns, attribute decorators

### Secondary (MEDIUM confidence)
- Phase 4 CONTEXT.md and RESEARCH.md — blueprint import approach, graph JSON format
- Warudo community knowledge — common node types (OnKeyPressNode, PlayAnimationNode, etc.)

### Tertiary (LOW confidence)
- Available WebSocket actions for node type enumeration — needs testing against live Warudo

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, extends existing patterns
- Architecture: HIGH - MCP resource + tool pattern well-understood, codebase patterns established
- Pitfalls: MEDIUM - port naming and node type format uncertainty requires testing
- Node catalog content: MEDIUM - based on SDK docs and community knowledge, needs verification

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain, Warudo API unlikely to change rapidly)
