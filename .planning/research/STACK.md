# Technology Stack

**Project:** WarudoMCP -- MCP server for Warudo 3D VTubing software
**Researched:** 2026-03-09

## Recommended Stack

### Runtime & Language

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 22.22.x LTS ("Jod") | JavaScript runtime | Current LTS with maintenance support through 2027-04. Built-in fetch API, WebSocket support improvements, type stripping for dev. | HIGH |
| TypeScript | ~5.9.3 | Type safety | Latest stable. Use 5.9 not 6.0 RC -- 6.0 is the last JS-based compiler and is still RC. 5.9 is battle-tested. | HIGH |

### MCP SDK

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @modelcontextprotocol/sdk | ^1.27.x (v1 branch) | MCP server framework | Production-recommended. v2 is pre-alpha targeting Q1 2026 stable release but not there yet. v1.x will get bug fixes for 6+ months after v2 ships. 31K+ downstream packages -- this is THE standard. | HIGH |

**Critical decision: v1 not v2.** The v2 SDK splits into `@modelcontextprotocol/server` and `@modelcontextprotocol/client` packages and requires Zod v4 as a peer dependency. While v2 is architecturally cleaner, it is pre-alpha. Use v1 (`@modelcontextprotocol/sdk`) which is a single package, stable, and well-documented. Migration to v2 later will be straightforward -- the API surface is similar.

**Import paths (v1):**
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
```

### Schema Validation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| zod | ^3.25.x | Tool input schema validation | Required peer dependency of MCP SDK v1. The SDK internally uses zod/v4 compatibility but accepts Zod 3.25+. Use 3.25+ (not 4.x) to match the v1 SDK's expected peer dependency range and avoid compatibility edge cases. | HIGH |

**Note on Zod v4:** Zod 4.3.6 is the latest release. The MCP SDK v1 added Zod v4 compatibility in recent releases, but earlier versions had breaking issues (GitHub issue #1429). Using zod@3.25+ is safer with v1 SDK. When migrating to MCP SDK v2 later, switch to Zod v4 at the same time.

### WebSocket Client

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ws | ^8.19.0 | WebSocket client to Warudo | The standard Node.js WebSocket library. Blazing fast, thoroughly tested, 8+ years of production use. Node.js has a built-in WebSocket in 22.x but `ws` is more mature for client-side use with reconnection handling and has first-class TypeScript support via @types/ws. | HIGH |

**Why not native WebSocket?** Node.js 22 has `WebSocket` globally available (based on undici), but it follows the browser API which lacks features needed for robust server-side connections: no ping/pong control, limited event handling. `ws` gives full control over the connection lifecycle.

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| @types/ws | ^8.5.x | TypeScript types for ws | Always -- compile-time type safety for WebSocket operations | HIGH |
| @types/node | ^22.x | Node.js type definitions | Always -- matches our Node 22 runtime | HIGH |
| tsx | ^4.x | TypeScript execution for dev | Development only -- run .ts files directly without build step. Faster iteration than tsc + node. | MEDIUM |
| pino | ^9.x | Structured logging to stderr | For any logging needs. CRITICAL: MCP stdio servers must NEVER write to stdout (corrupts JSON-RPC). Pino can be configured to write to stderr. | MEDIUM |

### Build & Development

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsc (via typescript) | ~5.9.3 | Production build | Simple, no bundler needed. MCP servers are not browser apps -- tsc compiling to ES2022/Node16 is sufficient. | HIGH |
| tsx | ^4.x | Dev runner | `tsx watch src/index.ts` for development. No build step needed during dev. | MEDIUM |

**No bundler needed.** This is a Node.js CLI tool distributed via npm. `tsc` compiles TypeScript to JavaScript, that's all we need. Webpack/Vite/esbuild are unnecessary complexity for an MCP server.

## Project Configuration

### package.json essentials

```json
{
  "type": "module",
  "bin": {
    "warudo-mcp": "./build/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node build/index.js"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Key tsconfig decisions:**
- `module: "Node16"` and `moduleResolution: "Node16"` -- required by the MCP SDK
- `target: "ES2022"` -- matches Node 22 capabilities (top-level await, etc.)
- `declaration: true` -- enables the future Warudo C# plugin to reference type definitions for tool schema reuse
- `sourceMap: true` -- debuggable stack traces in development

## No Database Needed

This is a stateless bridge server. It connects an MCP client to Warudo's WebSocket API. No persistent storage is required. Scene state lives in Warudo. Tool definitions are static code.

If state caching becomes needed later (e.g., caching Warudo's scene graph for faster queries), use an in-memory Map -- no external database.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| MCP SDK | @modelcontextprotocol/sdk v1 | @modelcontextprotocol/server v2 | v2 is pre-alpha. Ship on stable, migrate later. |
| WebSocket | ws | Native Node.js WebSocket | Native lacks ping/pong, reconnection control. ws is battle-tested for server-side use. |
| WebSocket | ws | socket.io-client | socket.io adds protocol overhead (engine.io). Warudo uses raw WebSocket, not socket.io. |
| Schema validation | zod 3.25+ | zod 4.x | MCP SDK v1 peer dep range. Avoid compatibility edge cases. Switch with v2 migration. |
| Schema validation | zod | ajv, joi, yup | MCP SDK requires zod. Not optional -- it's a peer dependency. |
| Build | tsc | esbuild, vite, webpack | Unnecessary for a Node.js CLI tool. tsc is simpler and sufficient. |
| Logging | pino (stderr) | winston, bunyan | Pino is faster, produces structured JSON. Winston is heavier with no benefit here. |
| Language | TypeScript | Python | PROJECT.md specifies TypeScript. Also: most MCP servers use TS SDK, better ecosystem alignment. |
| Dev runner | tsx | ts-node | tsx is faster (uses esbuild under the hood), better ESM support, simpler config. ts-node has known ESM issues. |
| Dev runner | tsx | node --experimental-strip-types | Node 22 type stripping is available but still has edge cases with decorators and complex types. tsx is more reliable. |

## Installation

```bash
# Core dependencies
npm install @modelcontextprotocol/sdk zod@3 ws

# Dev dependencies
npm install -D typescript @types/node @types/ws tsx

# Optional but recommended
npm install pino
npm install -D @types/pino
```

## Warudo Connection Details

**Port:** Warudo listens for WebSocket connections on port **19190** (same port used by OSC).

**Message format:** LOW confidence. The official Warudo documentation does not publicly document the WebSocket message format for external control in detail. The documented approach is:
- Warudo's editor and runtime communicate via WebSocket internally
- External tools can send WebSocket messages that trigger "On WebSocket Message Received" blueprint nodes
- The C# SDK provides programmatic scene/blueprint control, but the WebSocket wire protocol for external consumers is not formally specified

**This is the biggest research gap.** The project will need to:
1. Reverse-engineer the WebSocket protocol by connecting to a running Warudo instance and observing traffic
2. Check if the Warudo community has documented the protocol (Steam Workshop plugins like "Send Websocket Message Nodes" may provide clues)
3. Consider whether the MCP server should send simple trigger messages to pre-configured blueprint nodes OR attempt full API coverage

**Blueprint generation:** Warudo supports programmatic blueprint creation via its C# SDK (`Graph.AddNode<T>()`, `Graph.AddFlowConnection()`). The JSON export format exists but is explicitly called "hacky and not recommended" in official docs. For the MCP server, we will need to understand the JSON structure to generate blueprints externally over WebSocket, since we cannot call the C# API directly.

## Architecture Implications for Stack

The stack must support:

1. **Bidirectional communication:** MCP client <-> MCP server (stdio) AND MCP server <-> Warudo (WebSocket). The server is a bridge/proxy.
2. **Schema reusability:** Tool definitions should be extractable as JSON Schema so a future Warudo C# plugin can consume them. Zod schemas compile to JSON Schema via `zodToJsonSchema`.
3. **Reconnection resilience:** Warudo may restart during a session. The WebSocket client must reconnect automatically.
4. **No stdout contamination:** All logging must go to stderr. This is a hard requirement for stdio MCP transport.

## Sources

- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- HIGH confidence (official repo)
- [MCP Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server) -- HIGH confidence (official docs, includes full TypeScript example)
- [MCP SDK v2 docs](https://ts.sdk.modelcontextprotocol.io/v2/) -- HIGH confidence (official, confirms pre-alpha status)
- [MCP SDK npm page](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- HIGH confidence (v1.27.1, 31K dependents)
- [ws npm page](https://www.npmjs.com/package/ws) -- HIGH confidence (v8.19.0)
- [Warudo Handbook - API Overview](https://docs.warudo.app/docs/scripting/api/overview) -- MEDIUM confidence (covers C# SDK, limited WebSocket external API docs)
- [Warudo Handbook - Generating Blueprints](https://docs.warudo.app/docs/scripting/api/generating-blueprints) -- MEDIUM confidence (documents C# approach, JSON format called "hacky")
- [Warudo Handbook - Scene API](https://docs.warudo.app/docs/scripting/api/scene) -- MEDIUM confidence (C# SDK focused)
- [Warudo Steam Discussion on REST API](https://steamcommunity.com/app/2079120/discussions/0/3812908540893823781/) -- MEDIUM confidence (developer confirms WebSocket as the external control path)
- [Node.js 22.22.1 LTS release](https://nodejs.org/en/blog/release/v22.22.1) -- HIGH confidence
- [TypeScript 5.9 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/) -- HIGH confidence
- [Zod v4 + MCP SDK compatibility issue](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1429) -- HIGH confidence (GitHub issue documenting the problem)
