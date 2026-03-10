# Phase 1: MCP Server Foundation - Research

**Researched:** 2026-03-09
**Domain:** MCP server skeleton with WebSocket + REST connections to Warudo, stdio JSON-RPC transport
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Lazy connection -- connect to Warudo on first tool call, not at server start
- Server starts successfully even if Warudo isn't running yet
- Connection is established (or re-established) when a tool is actually called
- Warudo WebSocket API on port 19053 with documented actions: `setEntityDataInputPortValue`, `invokeEntityTriggerPort`, `sendPluginMessage`
- Warudo REST API on port 19052 with endpoints: GET /api/about, GET /api/scenes, PUT /api/openedScene
- Architecture should support future Warudo C# plugin reusing tool definitions

### Claude's Discretion
- Configuration approach (env vars, MCP client args, or both) -- use whatever is most standard for MCP servers
- Default host/port values (ws://localhost:19053, http://localhost:19052 are sensible defaults)
- Error detail level -- Claude decides between actionable vs simple errors
- Whether to translate Warudo errors or pass them through
- npm package name and MCP server registration name
- Project structure and file organization
- Error recovery behavior when Warudo disconnects mid-session

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONN-01 | MCP server connects to Warudo WebSocket API on configurable host:port (default ws://localhost:19053) | MCP SDK stdio transport pattern + `ws` library for WebSocket client; env var configuration pattern; lazy connection architecture |
| CONN-02 | MCP server connects to Warudo REST API on configurable host:port (default http://localhost:19052) | Node.js built-in `fetch` API (Node 22 LTS); same env var configuration pattern as WebSocket |
| CONN-03 | Server reports clear error messages when Warudo is unreachable or disconnects | MCP `isError` flag on tool results; connection state machine pattern; structured error messages |
</phase_requirements>

## Summary

Phase 1 is about building a working bridge process: an MCP server that speaks stdio JSON-RPC on one side and WebSocket/REST to Warudo on the other. No tools exist yet -- this phase establishes the skeleton, connection management, and error handling that all future phases depend on.

The MCP SDK v1 (`@modelcontextprotocol/sdk` ^1.27.x) provides `McpServer` and `StdioServerTransport` as the primary building blocks. Tool registration uses `server.tool()` with Zod schemas for input validation. The WebSocket connection to Warudo uses the `ws` library (^8.19.x) with a custom client wrapper that handles lazy connection, reconnection, and connection state tracking. The REST connection uses Node.js 22's built-in `fetch` API -- no additional HTTP library needed.

The most important architectural decision in this phase is the **lazy connection pattern**: the MCP server starts immediately on stdio without connecting to Warudo. Connections are established on first tool call. This means the server must track connection state and provide clear errors when Warudo is unreachable.

**Primary recommendation:** Build three core modules -- MCP server entry point (stdio transport), WarudoWebSocketClient (lazy connection + state tracking), and WarudoRestClient (simple fetch wrapper) -- with a shared configuration system using environment variables with MCP client `env` block support.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.27.x | MCP server framework | Official SDK, v1 branch. Provides `McpServer`, `StdioServerTransport`, tool registration with Zod schemas. 31K+ downstream packages. |
| ws | ^8.19.x | WebSocket client to Warudo | Standard Node.js WebSocket library. Full control over ping/pong, connection lifecycle, binary frames. 8+ years production use. |
| zod | ^3.25.x | Tool input schema validation | Required peer dependency of MCP SDK v1. Use 3.25+ (not 4.x) to match v1's expected peer range. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/ws | ^8.5.x | TypeScript types for ws | Always -- compile-time WebSocket type safety |
| @types/node | ^22.x | Node.js type definitions | Always -- matches Node 22 LTS runtime |
| typescript | ~5.9.x | TypeScript compiler | Build step. target ES2022, module Node16. |
| tsx | ^4.x | Dev runner | Development only -- `tsx watch src/index.ts` for fast iteration |

### No Additional HTTP Library Needed

Node.js 22 LTS has a stable built-in `fetch` API (based on undici). For the simple REST calls to Warudo (GET /api/about, GET /api/scenes, PUT /api/openedScene), native `fetch` is sufficient. No need for `axios`, `got`, or `node-fetch`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ws | Native Node.js WebSocket | Native lacks ping/pong control, less mature for client-side use |
| Native fetch | axios, got | Over-engineered for 3 simple REST endpoints |
| zod 3.25 | zod 4.x | MCP SDK v1 peer dep range; Zod 4 works but 3.25+ avoids edge cases |
| env vars | dotenv + .env file | Adds dependency; MCP clients pass env vars natively via config |

**Installation:**
```bash
# Core
npm install @modelcontextprotocol/sdk zod@3 ws

# Dev
npm install -D typescript @types/node @types/ws tsx
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  index.ts              # Entry point: create McpServer, connect stdio transport
  config.ts             # Configuration from env vars with defaults
  warudo/
    websocket-client.ts # WebSocket client with lazy connect, state tracking, reconnect
    rest-client.ts      # REST client wrapping fetch for Warudo HTTP API
    types.ts            # Warudo message types and response interfaces
  errors.ts             # Error types and MCP error formatting
```

### Pattern 1: MCP Server Entry Point (stdio)

**What:** Create McpServer, connect StdioServerTransport, register a minimal ping tool for testing.
**When:** First file to write. Everything depends on this.

```typescript
// src/index.ts
// Source: https://modelcontextprotocol.io/docs/develop/build-server (TypeScript tab)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "warudo-mcp",
  version: "0.1.0",
});

// Minimal tool for connection testing
server.tool(
  "ping",
  "Check if the MCP server is running and can reach Warudo",
  {},  // no input params
  async () => {
    return {
      content: [{ type: "text", text: "pong - MCP server is running" }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("warudo-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

**Key details verified from official docs:**
- Import paths use `.js` extension even in TypeScript (Node16 module resolution)
- `McpServer` constructor takes `{ name, version }` (HIGH confidence, official example)
- `server.tool(name, description, inputSchema, handler)` is the registration API (HIGH confidence)
- `inputSchema` is a plain object of Zod schemas (NOT a `z.object()` -- the SDK wraps it)
- Handler returns `{ content: [{ type: "text", text: string }] }` (HIGH confidence)
- All logging MUST use `console.error` (stderr). Never `console.log` (stdout). (HIGH confidence)

### Pattern 2: Lazy WebSocket Connection with State Tracking

**What:** WebSocket client that does not connect at construction. Connection happens on first `send()` or explicit `connect()`. Tracks state as `disconnected | connecting | connected`.
**When:** Every interaction with Warudo's WebSocket API.

```typescript
// src/warudo/websocket-client.ts
import WebSocket from "ws";

type ConnectionState = "disconnected" | "connecting" | "connected";

export class WarudoWebSocketClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  getState(): ConnectionState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.state === "connected") return;
    if (this.state === "connecting") {
      // Wait for in-progress connection
      return this.waitForConnection();
    }

    this.state = "connecting";
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);

      const timeout = setTimeout(() => {
        ws.close();
        this.state = "disconnected";
        reject(new Error(
          `Could not connect to Warudo at ${this.url}. ` +
          `Is Warudo running with WebSocket enabled?`
        ));
      }, 5000);

      ws.on("open", () => {
        clearTimeout(timeout);
        this.ws = ws;
        this.state = "connected";
        this.setupEventHandlers(ws);
        resolve();
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        this.state = "disconnected";
        reject(new Error(
          `Failed to connect to Warudo at ${this.url}: ${err.message}`
        ));
      });
    });
  }

  async ensureConnected(): Promise<void> {
    if (this.state !== "connected") {
      await this.connect();
    }
  }

  private setupEventHandlers(ws: WebSocket): void {
    ws.on("close", () => {
      this.state = "disconnected";
      this.ws = null;
      console.error("Warudo WebSocket disconnected");
    });

    ws.on("error", (err) => {
      console.error("Warudo WebSocket error:", err.message);
    });

    ws.on("message", (data) => {
      // Handle incoming messages (for future request-response correlation)
    });
  }

  // ... send methods, waitForConnection, close
}
```

### Pattern 3: REST Client with Native Fetch

**What:** Simple wrapper around `fetch` for Warudo's REST API. Three known endpoints.
**When:** Scene listing, version info, scene operations.

```typescript
// src/warudo/rest-client.ts
export class WarudoRestClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getAbout(): Promise<unknown> {
    return this.get("/api/about");
  }

  async getScenes(): Promise<unknown> {
    return this.get("/api/scenes");
  }

  async openScene(sceneName: string): Promise<unknown> {
    return this.put("/api/openedScene", { name: sceneName });
  }

  private async get(path: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(
        `Warudo REST API error: ${response.status} ${response.statusText} on GET ${path}`
      );
    }
    return response.json();
  }

  private async put(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(
        `Warudo REST API error: ${response.status} ${response.statusText} on PUT ${path}`
      );
    }
    return response.json();
  }
}
```

### Pattern 4: Configuration via Environment Variables

**What:** Read configuration from environment variables with sensible defaults. MCP clients pass env vars via the `env` block in their server configuration.
**When:** Server startup.

```typescript
// src/config.ts
export interface Config {
  warudoWsUrl: string;
  warudoRestUrl: string;
}

export function loadConfig(): Config {
  return {
    warudoWsUrl: process.env.WARUDO_WS_URL ?? "ws://localhost:19053",
    warudoRestUrl: process.env.WARUDO_REST_URL ?? "http://localhost:19052",
  };
}
```

**Why env vars over command-line args:** MCP clients (Claude Desktop, Cursor, Claude Code) all support `env` blocks in server configuration. This is the standard pattern. Example MCP client config:

```json
{
  "mcpServers": {
    "warudo-mcp": {
      "command": "node",
      "args": ["C:\\path\\to\\warudo-mcp\\build\\index.js"],
      "env": {
        "WARUDO_WS_URL": "ws://192.168.1.100:19053",
        "WARUDO_REST_URL": "http://192.168.1.100:19052"
      }
    }
  }
}
```

**Recommendation on discretion items:**
- **Configuration approach:** Environment variables only. No command-line argument parsing needed -- env vars are the MCP standard.
- **Package name:** `warudo-mcp` (short, descriptive, follows `{product}-mcp` convention seen in ecosystem)
- **MCP server registration name:** `warudo-mcp`

### Pattern 5: Error Handling for MCP Tools

**What:** When a tool call fails due to Warudo connectivity, return a structured error via MCP's `isError` flag rather than throwing an exception.
**When:** Every tool handler that touches Warudo.

```typescript
// Helper for tool handlers
function warudoError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

// Usage in a tool handler:
async function handleTool(warudoWs: WarudoWebSocketClient) {
  try {
    await warudoWs.ensureConnected();
    // ... do work
  } catch (err) {
    if (err instanceof Error && err.message.includes("Could not connect")) {
      return warudoError(
        "Cannot reach Warudo. Please ensure Warudo is running " +
        "and WebSocket is enabled on the configured port."
      );
    }
    return warudoError(`Warudo operation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
```

**Recommendation on error detail:** Return actionable errors that tell the user what to do, not raw stack traces. Examples:
- "Cannot reach Warudo at ws://localhost:19053. Is Warudo running with WebSocket enabled?"
- "Warudo disconnected during the operation. Reconnecting on next tool call."
- "Warudo REST API returned 404 on GET /api/about. Check that Warudo version supports the REST API."

### Anti-Patterns to Avoid

- **console.log anywhere:** Corrupts stdio JSON-RPC stream. Use `console.error` exclusively. Add a lint rule or convention to catch this.
- **Connecting at startup:** User decided lazy connection. The server MUST start successfully without Warudo running.
- **Throwing from tool handlers:** Unhandled exceptions crash the MCP server process. Always catch and return `{ isError: true }`.
- **Hardcoding ports:** Use configuration. Even though defaults are known (19053, 19052), users may run Warudo on different hosts.
- **Using `node-fetch` or `axios`:** Node.js 22 has built-in `fetch`. No extra HTTP dependency needed for 3 simple endpoints.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP JSON-RPC protocol | Custom JSON-RPC parser | `@modelcontextprotocol/sdk` McpServer + StdioServerTransport | Protocol is complex (capability negotiation, progress, etc.) |
| WebSocket client | Raw `net.Socket` or browser WebSocket API | `ws` library | Handles framing, ping/pong, backpressure, binary |
| Input validation | Manual type checking | Zod schemas via MCP SDK's `server.tool()` | SDK validates automatically when schemas are provided |
| Tool registration | Custom request routing | `server.tool()` API | SDK handles ListTools, CallTool, schema serialization |

**Key insight:** The MCP SDK handles the entire protocol. You never parse JSON-RPC yourself. You register tools with schemas and handlers -- the SDK does everything else.

## Common Pitfalls

### Pitfall 1: stdout Contamination

**What goes wrong:** Any output to stdout (console.log, dependency warnings, Node.js deprecation notices) corrupts the MCP JSON-RPC stream. Client disconnects with "Parse error" or "Connection closed."
**Why it happens:** Developer habit of using console.log. Some npm packages write to stdout.
**How to avoid:** Use `console.error` for ALL logging. Never use `console.log`. Consider overriding `process.stdout.write` in development to detect rogue writes.
**Warning signs:** Works when tested manually, fails when connected to Claude Desktop.

### Pitfall 2: Not Handling WebSocket Connection Failure Gracefully

**What goes wrong:** Tool handler calls `ws.send()` on a closed/null WebSocket. Throws unhandled error, crashes the MCP server process.
**Why it happens:** No connection state check before operations. Testing only with Warudo running.
**How to avoid:** Always call `ensureConnected()` before operations. Wrap in try-catch. Return MCP error responses, never throw.
**Warning signs:** Server crashes when Warudo isn't running.

### Pitfall 3: Import Path Extensions

**What goes wrong:** TypeScript imports without `.js` extensions fail at runtime with Node16 module resolution.
**Why it happens:** TypeScript source files are `.ts` but Node16 ESM requires `.js` extensions in import specifiers (they resolve to the compiled `.js` files).
**How to avoid:** Always use `.js` extensions in import paths: `import { foo } from "./bar.js"` even though the source file is `bar.ts`.
**Warning signs:** `tsc` compiles fine but `node build/index.js` fails with ERR_MODULE_NOT_FOUND.

### Pitfall 4: Zod Schema Wrapping Mismatch

**What goes wrong:** Passing `z.object({...})` to `server.tool()` inputSchema parameter instead of a plain object of Zod schemas.
**Why it happens:** Intuition says inputSchema should be a Zod object schema. But the MCP SDK's `server.tool()` API takes a **plain object** where each value is a Zod type. The SDK wraps it in `z.object()` internally.
**How to avoid:** Pass `{ param: z.string() }` not `z.object({ param: z.string() })`.
**Warning signs:** Tool registration succeeds but schema serialization produces nested/wrong JSON Schema.

### Pitfall 5: Windows Path Issues in MCP Client Config

**What goes wrong:** MCP client can't find the server executable. Server fails to start from Claude Desktop on Windows.
**Why it happens:** Relative paths, forward vs backslash confusion, spaces in paths.
**How to avoid:** Document the exact MCP client configuration with absolute Windows paths. Use `node` command with absolute path to `build/index.js`.
**Warning signs:** Works from terminal, fails from Claude Desktop.

## Code Examples

### Complete Minimal MCP Server (verified pattern)

```typescript
// Source: https://modelcontextprotocol.io/docs/develop/build-server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "warudo-mcp",
  version: "0.1.0",
});

// Tool with Zod schema validation
server.tool(
  "example_tool",
  "Description for the LLM",
  {
    myParam: z.string().describe("What this parameter is for"),
    optionalParam: z.number().optional().describe("Optional number"),
  },
  async ({ myParam, optionalParam }) => {
    // Handler receives validated, typed arguments
    return {
      content: [{ type: "text", text: `Result: ${myParam}` }],
    };
  }
);

// Error response pattern
server.tool("failing_tool", "Shows error pattern", {}, async () => {
  return {
    content: [{ type: "text", text: "Something went wrong" }],
    isError: true,
  };
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Server running");
```

### WebSocket Client Connection (ws library pattern)

```typescript
// Source: ws npm documentation + Node.js patterns
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:19053");

ws.on("open", () => {
  console.error("Connected to Warudo WebSocket");
});

ws.on("message", (data: WebSocket.Data) => {
  const message = JSON.parse(data.toString());
  console.error("Received:", JSON.stringify(message));
});

ws.on("close", (code: number, reason: Buffer) => {
  console.error(`WebSocket closed: ${code} ${reason.toString()}`);
});

ws.on("error", (err: Error) => {
  console.error("WebSocket error:", err.message);
});
```

### MCP Client Configuration (Claude Desktop / Cursor)

```json
{
  "mcpServers": {
    "warudo-mcp": {
      "command": "node",
      "args": ["C:\\Users\\VTOKU\\path\\to\\warudo-mcp\\build\\index.js"],
      "env": {
        "WARUDO_WS_URL": "ws://localhost:19053",
        "WARUDO_REST_URL": "http://localhost:19052"
      }
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MCP SDK v0.x with `Server` class | MCP SDK v1 with `McpServer` class | Late 2024 | `McpServer` is the high-level API. `Server` is low-level. Use `McpServer`. |
| `server.setRequestHandler(ListToolsRequestSchema, ...)` | `server.tool(name, desc, schema, handler)` | MCP SDK v1 | Much simpler registration API. Old pattern still works but is verbose. |
| node-fetch for HTTP | Built-in fetch (Node 18+) | 2023 | No extra dependency for HTTP requests |
| zod 3.x only | zod 3.25+ or 4.x with MCP SDK | SDK v1.23+ | Both work, but stick with 3.25+ for v1 SDK |

**Deprecated/outdated:**
- `@modelcontextprotocol/server` (v2 package): Pre-alpha. Do not use yet.
- `Server` class (low-level): Still works but prefer `McpServer` for new code.
- `node-fetch`: Unnecessary on Node 22.

## Open Questions

1. **Warudo WebSocket message format for external API**
   - What we know: Port 19053 is confirmed by user's SDK reference. Actions include `setEntityDataInputPortValue`, `invokeEntityTriggerPort`, `sendPluginMessage`. REST API on 19052.
   - What's unclear: The exact JSON wire format for WebSocket messages. The project research flagged this as a gap, but the user has an SDK reference documenting the protocol.
   - Recommendation: Trust the user's SDK reference for message format. Build the WebSocket client to send JSON messages matching the documented actions. Validate by testing against a running Warudo instance in Phase 1.

2. **Reconnection scope for Phase 1 vs Phase 2**
   - What we know: CONN-03 requires "clear error messages when Warudo disconnects." Auto-reconnect with exponential backoff is listed as v2 requirement CONN-04.
   - What's unclear: Should Phase 1 implement basic reconnection (try once on next tool call) or just error reporting?
   - Recommendation: Phase 1 should implement lazy re-connection (if disconnected, try to connect on next tool call). This naturally satisfies "clear error messages" without full exponential backoff. Full auto-reconnect with backoff is v2 scope (CONN-04).

3. **Package name finalization**
   - Recommendation: `warudo-mcp` for npm package name and MCP server registration name. Follows ecosystem convention (`{product}-mcp`).

## Sources

### Primary (HIGH confidence)
- [MCP TypeScript SDK - GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- Official repository, SDK architecture
- [MCP Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server) -- Official tutorial with TypeScript code examples (verified import paths, tool registration API, server startup pattern)
- [MCP SDK npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- Version 1.27.1, package metadata

### Secondary (MEDIUM confidence)
- [MCP Server Config with Environment Variables](https://dev.to/saleor/dynamic-configuration-for-mcp-servers-using-environment-variables-2a0o) -- Confirms env var pattern as standard for MCP servers
- [Warudo Handbook - Ports & Triggers](https://docs.warudo.app/docs/scripting/api/ports-and-triggers) -- Data input ports, trigger ports, Warudo's internal API model
- [Warudo Handbook - API Overview](https://docs.warudo.app/docs/scripting/api/overview) -- Editor-runtime WebSocket architecture

### Tertiary (LOW confidence)
- Warudo REST API on port 19052 -- user-provided from SDK reference, not found in public documentation. Trusted because user has working knowledge of the protocol.
- Warudo WebSocket on port 19053 -- user-provided from SDK reference. Not independently verified in public docs (public docs mention port 19190 for OSC/WebSocket, but user's reference is more authoritative for their Warudo version).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- MCP SDK, ws, Zod are well-documented with official examples
- Architecture: HIGH -- Bridge pattern is straightforward; lazy connection is a clear requirement
- Pitfalls: HIGH -- stdout corruption and connection lifecycle are well-documented issues in the MCP ecosystem
- Warudo protocol details: MEDIUM -- ports and actions come from user's SDK reference, not independently verified public docs

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain, 30-day validity)
