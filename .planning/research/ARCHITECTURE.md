# Architecture Patterns

**Domain:** MCP server bridging AI assistants to Warudo (3D VTubing software)
**Researched:** 2026-03-09

## Recommended Architecture

The system is a **bridge server** with three distinct layers: an MCP protocol layer (stdio), a tool registry with business logic, and a WebSocket client layer that talks to Warudo. The critical design constraint is that tool definitions must be extractable as JSON Schema so a future Warudo C# plugin can reuse them without the TypeScript runtime.

```
+------------------+       stdio        +---------------------------+
|  MCP Client      | <================> |  MCP Protocol Layer       |
|  (Claude Desktop,|                    |  (McpServer + stdio       |
|   Cursor, etc.)  |                    |   transport)              |
+------------------+                    +---------------------------+
                                               |
                                               | tool dispatch
                                               v
                                        +---------------------------+
                                        |  Tool Registry            |
                                        |  - Tool definitions       |
                                        |    (Zod schemas)          |
                                        |  - Tool handlers          |
                                        |  - Blueprint generator    |
                                        +---------------------------+
                                               |
                                               | commands / queries
                                               v
                                        +---------------------------+
                                        |  Warudo Client Layer      |
                                        |  - WebSocket connection   |
                                        |  - Message serialization  |
                                        |  - Response correlation   |
                                        |  - Reconnection logic     |
                                        +---------------------------+
                                               |
                                               | WebSocket (ws://)
                                               v
                                        +---------------------------+
                                        |  Warudo Runtime           |
                                        |  (localhost:19190 or      |
                                        |   configured port)        |
                                        +---------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **MCP Protocol Layer** | Handles MCP JSON-RPC over stdio; capability negotiation; request routing to tool handlers | MCP Client (upstream), Tool Registry (downstream) |
| **Tool Registry** | Defines all available tools with Zod schemas; dispatches validated arguments to handlers; groups tools by domain (avatar, scene, blueprint, etc.) | MCP Protocol Layer (receives calls), Warudo Client (sends commands), Blueprint Engine (for complex generation) |
| **Blueprint Generation Engine** | Translates high-level blueprint descriptions into Warudo's graph JSON format (nodes, connections, ports) | Tool Registry (receives requests), Warudo Client (sends generated blueprints) |
| **Warudo Client** | Maintains WebSocket connection to Warudo; serializes/deserializes messages; correlates request-response pairs; handles reconnection | Tool Registry / Blueprint Engine (receives commands), Warudo Runtime (sends/receives WebSocket messages) |
| **Schema Export Module** | Extracts tool definitions as JSON Schema files for consumption by the future C# plugin | Tool Registry (reads definitions), filesystem (writes JSON) |

### Data Flow

**Tool invocation (happy path):**

```
1. MCP Client sends JSON-RPC request via stdio
2. MCP Protocol Layer validates, routes to registered tool handler
3. Tool handler validates input against Zod schema
4. Handler calls Warudo Client with structured command
5. Warudo Client serializes to WebSocket message, sends to Warudo
6. Warudo processes, returns response via WebSocket
7. Warudo Client deserializes response, returns to handler
8. Handler formats MCP CallToolResult (text/structured content)
9. MCP Protocol Layer sends JSON-RPC response via stdio
```

**Blueprint generation flow:**

```
1. MCP Client requests blueprint creation (e.g., "create a blueprint that waves when chat says hello")
2. Tool handler delegates to Blueprint Generation Engine
3. Engine constructs graph JSON: nodes array, flow connections, data connections
4. Engine sends graph JSON to Warudo Client for import
5. Warudo Client sends via WebSocket (using graph import API)
6. Warudo loads blueprint, returns confirmation
7. Response flows back through MCP
```

**Scene state query flow:**

```
1. MCP Client asks for current scene state
2. Tool handler calls Warudo Client to query assets/nodes
3. Warudo returns scene JSON (assets, graphs, settings)
4. Handler extracts relevant data, formats as MCP response
```

## Patterns to Follow

### Pattern 1: Declarative Tool Definitions with Schema-First Design

**What:** Define each tool as a standalone module exporting a Zod schema, description, and handler function. Zod schemas serve as the single source of truth for both runtime validation and JSON Schema export.

**When:** Every tool definition.

**Why:** Enables the Schema Export Module to generate JSON Schema files that the future C# plugin can consume. The C# plugin will not run TypeScript -- it needs static JSON Schema definitions it can load.

**Example:**

```typescript
// src/tools/avatar/set-expression.ts
import { z } from "zod";
import { WarudoClient } from "../../warudo/client.js";

export const schema = z.object({
  characterName: z.string().describe("Name of the character asset"),
  expression: z.string().describe("Expression name to activate"),
  transient: z.boolean().default(true).describe("Whether expression is temporary"),
});

export const description = "Set a character's facial expression";
export const name = "avatar_expression_set";

export async function handler(
  args: z.infer<typeof schema>,
  warudo: WarudoClient
) {
  const result = await warudo.setExpression(args.characterName, args.expression, args.transient);
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
}
```

```typescript
// src/tools/registry.ts
import { McpServer } from "@modelcontextprotocol/server";
import * as setExpression from "./avatar/set-expression.js";
// ... import other tools

const tools = [setExpression, /* ... */];

export function registerAll(server: McpServer, warudo: WarudoClient) {
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema, (args) =>
      tool.handler(args, warudo)
    );
  }
}
```

### Pattern 2: Domain-Grouped Tool Organization

**What:** Organize tools into domain directories that mirror Warudo's asset/feature categories.

**When:** Always -- prevents a flat file of 50+ tool definitions.

**Example directory structure:**

```
src/
  tools/
    avatar/           # CharacterAsset operations
      set-expression.ts
      play-animation.ts
      set-pose.ts
      toggle-meshes.ts
    scene/            # Scene-level operations
      list-assets.ts
      add-asset.ts
      remove-asset.ts
      get-state.ts
    camera/           # Camera operations
      set-position.ts
      set-target.ts
    props/            # Prop operations
      add-prop.ts
      transform-prop.ts
    blueprint/        # Blueprint/graph operations
      create-blueprint.ts
      list-blueprints.ts
      add-node.ts
      connect-nodes.ts
    registry.ts       # Auto-discovers and registers all tools
```

### Pattern 3: Request-Response Correlation for WebSocket

**What:** Warudo's WebSocket is bidirectional but not inherently request-response. Implement correlation IDs to match responses to requests using a pending-request map.

**When:** Every WebSocket command that expects a response.

**Example:**

```typescript
// src/warudo/client.ts
class WarudoClient {
  private ws: WebSocket;
  private pending = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();

  async send(message: WarudoMessage): Promise<WarudoResponse> {
    const id = crypto.randomUUID();
    const tagged = { ...message, correlationId: id };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Warudo request timed out: ${message.type}`));
      }, 10000);

      this.pending.set(id, { resolve, reject, timeout });
      this.ws.send(JSON.stringify(tagged));
    });
  }

  private onMessage(raw: string) {
    const msg = JSON.parse(raw);
    const pending = this.pending.get(msg.correlationId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pending.delete(msg.correlationId);
      pending.resolve(msg);
    }
  }
}
```

### Pattern 4: Blueprint Graph Builder (Fluent API)

**What:** A builder abstraction that constructs Warudo-compatible graph JSON without requiring knowledge of internal node type UUIDs. Maps human-readable node names to Warudo node type IDs.

**When:** Blueprint generation tools.

**Example:**

```typescript
// src/blueprint/builder.ts
class BlueprintBuilder {
  private nodes: GraphNode[] = [];
  private flowConnections: FlowConnection[] = [];
  private dataConnections: DataConnection[] = [];

  addNode(typeId: string, config?: Record<string, unknown>): string {
    const id = crypto.randomUUID();
    this.nodes.push({ id, typeId, dataInputs: config ?? {} });
    return id; // return node instance ID for connecting
  }

  connectFlow(fromNodeId: string, fromPort: string, toNodeId: string, toPort: string) {
    this.flowConnections.push({ fromNodeId, fromPort, toNodeId, toPort });
    return this;
  }

  connectData(fromNodeId: string, fromPort: string, toNodeId: string, toPort: string) {
    this.dataConnections.push({ fromNodeId, fromPort, toNodeId, toPort });
    return this;
  }

  build(): WarudoGraph {
    return {
      name: this.name,
      enabled: true,
      nodes: this.nodes,
      flowConnections: this.flowConnections,
      dataConnections: this.dataConnections,
    };
  }
}
```

### Pattern 5: Connection Lifecycle Management

**What:** The WebSocket connection to Warudo must handle disconnection, reconnection, and connection state. Tools should fail gracefully when Warudo is unreachable rather than hanging.

**When:** Always -- Warudo may not be running when the MCP server starts.

**Key behaviors:**
- Lazy connection: connect on first tool call, not at server startup
- Exponential backoff reconnection (1s, 2s, 4s, 8s, max 30s)
- Connection state exposed so tools can return clear errors
- Configurable Warudo host/port via environment variables

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Tool File

**What:** Defining all 50+ tools in a single file with inline schemas and handlers.
**Why bad:** Unmaintainable, impossible to test individual tools, merge conflicts, and makes schema export painful.
**Instead:** One file per tool, grouped by domain directory, auto-discovered by registry.

### Anti-Pattern 2: Tight Coupling Between Tool Logic and WebSocket Protocol

**What:** Tool handlers directly constructing WebSocket message strings and parsing raw responses.
**Why bad:** Every tool becomes a WebSocket protocol expert. Protocol changes break everything. Cannot test tools without a live Warudo connection.
**Instead:** Warudo Client abstracts all WebSocket communication. Tool handlers call typed methods on the client. Client handles serialization, correlation, and error mapping.

### Anti-Pattern 3: Hardcoded Node Type UUIDs in Tool Handlers

**What:** Blueprint tools embedding Warudo node type GUIDs directly in handler code.
**Why bad:** UUIDs are opaque, fragile across Warudo versions, and make code unreadable.
**Instead:** Maintain a node type registry (JSON/TypeScript map) that maps human-readable names to UUIDs. Load from a discoverable catalog. The blueprint builder references names, the registry resolves to UUIDs.

### Anti-Pattern 4: Synchronous Blocking on WebSocket Responses

**What:** Using synchronous waits or polling loops to get WebSocket responses.
**Why bad:** Blocks the Node.js event loop, degrades performance for concurrent tool calls, can cause stdio deadlocks.
**Instead:** Promise-based async/await with correlation IDs (see Pattern 3).

### Anti-Pattern 5: Embedding MCP Protocol Details in Business Logic

**What:** Tool handlers directly constructing MCP JSON-RPC responses or reading MCP request headers.
**Why bad:** Couples tool logic to MCP protocol version. Makes tools non-reusable from C# plugin.
**Instead:** Tools return plain data objects. The registry layer wraps them into MCP CallToolResult format.

## Key Architecture Decisions

### Decision 1: Schema-First Tool Definitions (for C# plugin reuse)

The most important architectural constraint is future C# plugin compatibility. The approach:

1. **Zod schemas are the source of truth** in TypeScript
2. **A build step exports schemas to JSON Schema files** (using `zod-to-json-schema`)
3. **JSON Schema files are committed to the repo** in a `schemas/` directory
4. **The future C# plugin reads these JSON Schema files** to register equivalent tools with Claude's API directly

This means tool definitions must be **purely declarative** -- no runtime TypeScript logic embedded in schemas. The handler logic will differ between TS and C#, but the tool name, description, and input schema are shared.

```
schemas/
  tools/
    avatar_expression_set.json
    avatar_animation_play.json
    scene_asset_list.json
    blueprint_create.json
    ...
```

### Decision 2: Warudo Communication Strategy

**CRITICAL RESEARCH GAP:** Warudo's external WebSocket API is poorly documented publicly. The internal editor-to-runtime protocol is WebSocket-based, but the exact message format for external consumers is not specified in official docs. The "On WebSocket Message Received" blueprint node suggests Warudo can receive arbitrary WebSocket messages, but the protocol for structured command-and-response (querying scene state, modifying assets, etc.) is unclear.

**Recommended approach:** Phase 1 must include **API discovery** -- connecting to Warudo's WebSocket, sniffing the editor-runtime protocol, and documenting the actual message format. The architecture should wrap this in the Warudo Client layer so protocol details are isolated.

**Possible communication models (to be validated):**
1. **Editor protocol reuse:** Send the same messages the Warudo editor sends (likely JSON with action type, entity ID, data payload)
2. **Blueprint trigger model:** Send simple string messages that trigger "On WebSocket Message Received" nodes in pre-built blueprints
3. **Plugin-mediated model:** Build a lightweight Warudo plugin that exposes a structured API via WebSocket, acting as a command interpreter

Model 1 is ideal (full control). Model 2 is limited (requires pre-built blueprints). Model 3 is the fallback but contradicts the "no plugin for v1" constraint.

### Decision 3: Process Architecture

The MCP server runs as a **single Node.js process** communicating via stdio with the MCP client and via WebSocket with Warudo. No database, no separate services. Configuration via environment variables or a `.env` file.

```
ENV VARS:
  WARUDO_HOST=localhost    # Warudo WebSocket host
  WARUDO_PORT=19190        # Warudo WebSocket port (needs validation)
  WARUDO_RECONNECT=true    # Auto-reconnect on disconnect
  WARUDO_TIMEOUT=10000     # Request timeout in ms
```

## Suggested Build Order (Dependencies)

The architecture has clear dependency chains that dictate build order:

```
Phase 1: Foundation
  |- Warudo Client (WebSocket connection, message protocol discovery)
  |- MCP Server skeleton (McpServer + stdio transport, no tools yet)
  |- Project scaffolding (TypeScript, build config, dev tooling)

Phase 2: Core Tools
  |- Tool registry infrastructure (auto-discovery, registration)
  |- Scene query tools (read-only, lowest risk)
  |- Avatar control tools (expressions, animations)
  +- Depends on: Phase 1 (working WebSocket + MCP skeleton)

Phase 3: Scene Mutation
  |- Scene modification tools (add/remove assets, transform props)
  |- Camera control tools
  +- Depends on: Phase 2 (tool patterns established)

Phase 4: Blueprint Engine
  |- Node type registry (name-to-UUID mapping)
  |- Blueprint builder (graph construction API)
  |- Blueprint generation tools (create, modify, connect)
  +- Depends on: Phase 2-3 (tool patterns + scene understanding)

Phase 5: Schema Export & Polish
  |- JSON Schema export build step
  |- schemas/ directory generation
  |- Error handling hardening
  |- Documentation
  +- Depends on: Phase 2-4 (stable tool definitions)
```

**Why this order:**
- Warudo Client must come first because everything depends on talking to Warudo. The protocol discovery work in Phase 1 unblocks all subsequent phases.
- Read-only scene queries before mutations -- validates the protocol understanding before making changes.
- Blueprint generation is the most complex feature and depends on understanding Warudo's node system, which is learned during Phases 2-3.
- Schema export comes last because tool definitions must stabilize first. Exporting schemas from a moving target wastes effort.

## Scalability Considerations

| Concern | Single User (v1) | Multi-User (future) | Notes |
|---------|-------------------|---------------------|-------|
| WebSocket connections | 1 connection to 1 Warudo instance | Would need connection pooling or per-user instances | Not needed for v1 -- single user, single Warudo |
| Concurrent tool calls | Sequential is fine | May need request queuing | MCP clients typically send one tool call at a time |
| Blueprint complexity | Small graphs (5-20 nodes) | Large graphs (100+ nodes) | Builder pattern scales, but node registry needs to be complete |
| Tool count | 20-50 tools | 100+ tools | Directory-based organization handles this |

## Sources

- [Warudo Handbook - Scripting API Overview](https://docs.warudo.app/docs/scripting/api/overview) -- Editor/runtime WebSocket architecture (MEDIUM confidence)
- [Warudo Handbook - Generating Blueprints](https://docs.warudo.app/docs/scripting/api/generating-blueprints) -- Graph/node/connection API (HIGH confidence for C# side, needs validation for external API)
- [Warudo Handbook - Nodes](https://docs.warudo.app/docs/scripting/api/nodes) -- Node type system, categories, lifecycle (HIGH confidence)
- [Warudo Handbook - Ports & Triggers](https://docs.warudo.app/docs/scripting/api/ports-and-triggers) -- Data ports, flow ports, trigger invocation (HIGH confidence)
- [Warudo Handbook - Scene](https://docs.warudo.app/docs/scripting/api/scene) -- Scene data model, asset/graph access (HIGH confidence)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- McpServer, tool registration, stdio transport (HIGH confidence)
- [MCP TypeScript SDK DeepWiki](https://deepwiki.com/modelcontextprotocol/typescript-sdk) -- SDK architecture layers, Zod v4 (MEDIUM confidence)
- [Warudo Plugin Examples](https://github.com/HakuyaLabs/WarudoPluginExamples) -- WebSocketService usage patterns (MEDIUM confidence -- code not fully inspected)
- [MCP Tool Schema specification](https://modelcontextprotocol.io/specification/draft/server/tools) -- JSON Schema tool definitions (HIGH confidence)
- [Steam Discussion - Blueprint REST API](https://steamcommunity.com/app/2079120/discussions/0/3812908540893823781/) -- Confirms no REST API yet, WebSocket is the path (MEDIUM confidence)

### Confidence Notes

| Area | Confidence | Notes |
|------|------------|-------|
| MCP server structure | HIGH | Well-documented SDK with clear patterns |
| Tool registry pattern | HIGH | Standard MCP SDK approach, well established |
| Blueprint generation model | MEDIUM | C# API is documented; how to trigger it externally via WebSocket is not |
| Warudo WebSocket protocol | LOW | Internal protocol not publicly documented; port 19190 mentioned in one source but unverified |
| Schema export for C# reuse | MEDIUM | JSON Schema is the right format; exact C# consumption path is future work |
| Connection management | HIGH | Standard WebSocket patterns, well-understood |
