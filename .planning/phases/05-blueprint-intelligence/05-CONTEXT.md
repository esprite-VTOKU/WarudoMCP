# Phase 5: Blueprint Intelligence - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Natural language to blueprint generation. Users describe desired behavior in plain language (e.g., "when I press spacebar, make the character wave") and the AI generates a working blueprint using the `create_blueprint` tool from Phase 4. This phase provides the knowledge layer — node type catalogs, connection rules, and prompt patterns — that enables the AI to translate intent into valid graph structures. The CRUD primitives already exist; this phase makes them usable without expert knowledge.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- How to represent the Warudo node type catalog — whether as an MCP resource, a static JSON file bundled with the server, or inline tool descriptions
- Whether to add a `generate_blueprint` tool that wraps `create_blueprint` with NL understanding, or rely on the AI client's own reasoning to call `create_blueprint` with the right parameters
- Node type discovery approach — a `list_node_types` tool that queries Warudo for available node types and their port schemas, so the AI knows what building blocks exist
- How to provide connection rules and port compatibility info to the AI — embedded in tool descriptions, separate reference tool, or MCP resources
- Validation strategy — whether to validate generated blueprints before sending to Warudo (check node type existence, port compatibility) or let Warudo reject invalid graphs
- How to handle ambiguous NL descriptions — whether the tool itself asks clarifying questions or returns structured "needs clarification" responses
- Error recovery for invalid blueprints — whether to attempt auto-fix (e.g., suggest alternative node types) or return the error with guidance
- Template/pattern system — whether to include common blueprint patterns (e.g., "on key press do action") as built-in templates the AI can reference

</decisions>

<specifics>
## Specific Ideas

- The AI assistant using MCP tools IS the language model — Phase 5 is about giving it enough context (node catalog, connection rules) to generate valid `create_blueprint` calls from NL
- Phase 4's `CreateBlueprintInput` interface is the target format: nodes with typeIds, data connections, flow connections
- Warudo node types include: OnKeyPressNode, PlayAnimationNode, SetExpressionNode, WaitNode, etc. — need to discover the full catalog
- SDK reference documents `[NodeType]`, `[DataInput]`, `[DataOutput]`, `[Trigger]`, `[FlowOutput]` attribute patterns
- Requirement BPRT-03: "User can describe a desired behavior in natural language and the AI generates and imports a working blueprint"
- Success criterion: "When a blueprint description is ambiguous or references unknown capabilities, the AI asks clarifying questions or explains what is not possible rather than generating invalid graphs"
- User's SDK reference at github.com/esprite-VTOKU/warudo-plugin-skill contains node type documentation

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `create_blueprint` tool (Phase 4) — accepts structured `CreateBlueprintInput` with nodes, dataConnections, flowConnections
- `buildGraphJson()` — converts structured input to Warudo graph JSON format
- `list_blueprints` tool — can verify created blueprints appear in scene
- `WarudoWebSocketClient.send()` — may support querying available node types
- `warudoError()` — structured error responses with actionable guidance
- `src/tools/blueprint-tools.ts` — modular tool pattern established in Phase 4

### Established Patterns
- Tool handlers in `src/tools/` directory (established by Phase 4 refactor)
- Defensive response parsing with field name fallbacks
- Error messages that suggest next steps (e.g., "use list_assets to find IDs")
- Index-based node references in connections (sourceNodeIndex/destNodeIndex)
- 12 tools currently registered — room for 1-3 more within 8-15 target

### Integration Points
- New tools register in `src/index.ts` alongside existing 12 tools
- Builds on Phase 4's `CreateBlueprintInput` interface and `buildGraphJson()`
- May add MCP resources for node type catalog (server.resource() API)
- WebSocket `getScene` response may contain node type metadata

</code_context>

<deferred>
## Deferred Ideas

None — auto mode, discussion stayed within phase scope

</deferred>

---

*Phase: 05-blueprint-intelligence*
*Context gathered: 2026-03-09*
