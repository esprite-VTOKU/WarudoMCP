# Pitfalls Research

**Domain:** MCP server bridging AI assistants to a real-time 3D VTubing application (Warudo) via WebSocket
**Researched:** 2026-03-09
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: Tool Explosion Overwhelming the LLM Context Window

**What goes wrong:**
Exposing every Warudo WebSocket API endpoint as a separate MCP tool creates dozens or hundreds of tools. Each tool's name, description, and JSON schema consumes tokens in every LLM request. Cursor enforces a hard limit of 40 MCP tools total; GitHub Copilot caps at 128. Even without hard limits, LLMs degrade in tool selection accuracy when presented with too many options -- they hallucinate tool names, pick wrong tools, or waste tokens reasoning about irrelevant tools.

**Why it happens:**
The PROJECT.md states "Full Warudo WebSocket API coverage exposed as MCP tools." Developers naturally map 1 API endpoint = 1 MCP tool. With avatar control, scene management, camera, lighting, props, blueprints, and environment endpoints, this easily exceeds 50+ tools.

**How to avoid:**
- Design coarse-grained, task-oriented tools instead of fine-grained API wrappers. Example: `control_avatar` with a structured action parameter instead of separate `set_expression`, `set_animation`, `set_pose`, `set_motion` tools.
- Group related operations behind a single tool with an `action` discriminator field. The LLM sees 8-12 tools instead of 60+.
- Use detailed `enum` values in the action parameter so the LLM knows available operations without separate tool descriptions.
- Consider a "list capabilities" resource/tool that returns available operations dynamically rather than encoding them all in tool schemas.

**Warning signs:**
- Tool count exceeds 20-25 during development.
- Token usage per request climbs above 5,000 tokens just for tool definitions.
- LLM starts picking wrong tools or inventing tool names that do not exist.
- Claude Desktop or Cursor shows sluggish response times.

**Phase to address:**
Phase 1 (Architecture/Foundation). Tool design is the single most important architectural decision. Getting this wrong requires a full rewrite of every tool definition.

---

### Pitfall 2: stdout Corruption in stdio Transport

**What goes wrong:**
The MCP stdio transport uses stdout exclusively for JSON-RPC messages. Any stray output to stdout -- from console.log, dependency warnings, Node.js deprecation notices, or the WebSocket library logging -- corrupts the protocol stream. The MCP client receives malformed JSON, drops the connection, and reports cryptic errors like "Connection closed" or "Parse error."

**Why it happens:**
Developers habitually use `console.log` for debugging. Many npm packages write to stdout by default. On Windows specifically, Node.js startup can emit warnings about experimental features. The WebSocket client library (`ws`) may log connection events to stdout.

**How to avoid:**
- Use `console.error` (stderr) exclusively for all logging. Never use `console.log` anywhere in the codebase.
- Set up a structured logger (e.g., pino or winston) configured to write only to stderr or a file.
- Add a lint rule or pre-commit hook that flags `console.log` usage.
- Intercept stdout early in the process to catch rogue writes: override `process.stdout.write` in development to throw if anything unexpected appears.
- Test the server in stdio mode from day one, not just via direct invocation.

**Warning signs:**
- Server works when tested manually but fails when connected to Claude Desktop.
- "Connection closed" errors with no clear cause.
- Intermittent failures that depend on which npm packages are loaded.

**Phase to address:**
Phase 1 (Foundation). Establish the logging discipline and stdio transport testing from the first line of code.

---

### Pitfall 3: WebSocket Connection Lifecycle Mismanagement

**What goes wrong:**
The MCP server process starts, creates a WebSocket connection to Warudo, and assumes it stays connected. Warudo restarts, the network hiccups, or the user switches scenes -- the WebSocket drops. The MCP server continues accepting tool calls but every operation fails silently or throws unhandled errors. Worse: the server may crash entirely, taking down the MCP client's connection.

**Why it happens:**
WebSocket connections are stateful and fragile. Unlike HTTP, there is no natural retry per request. Developers test with Warudo running and never test the disconnection/reconnection path. The MCP protocol has no built-in mechanism for reporting "backend unavailable" -- the server must handle this itself.

**How to avoid:**
- Implement automatic reconnection with exponential backoff (1s, 2s, 4s, max 30s).
- Track connection state explicitly: `connected`, `connecting`, `disconnected`.
- On tool calls when disconnected, return a structured error via the MCP `isError` flag rather than throwing. The error message should tell the user "Warudo is not connected. Please ensure Warudo is running and WebSocket is enabled."
- Implement a health-check ping on the WebSocket (Warudo uses WebSocketSharp which supports ping/pong).
- Add a `get_connection_status` tool so the LLM can check before attempting operations.

**Warning signs:**
- No reconnection logic in the WebSocket client code.
- Tool handlers that do not check connection state before sending messages.
- Unhandled promise rejections in the Node.js process.

**Phase to address:**
Phase 1 (Foundation). The WebSocket client wrapper with reconnection must be built before any tools are added.

---

### Pitfall 4: Treating Warudo's Internal Editor-Runtime Protocol as a Stable Public API

**What goes wrong:**
Warudo's WebSocket communication is primarily designed for its own editor-runtime synchronization, not as a public API for third-party consumers. The message format, node type IDs, and data structures may change between Warudo updates without notice. The project builds against an internal protocol and breaks silently on Warudo version bumps.

**Why it happens:**
Warudo's documentation explicitly warns that "the JSON format may change in future versions" for blueprint data. The WebSocket API is documented for plugin developers working within Warudo's C# ecosystem, not for external TypeScript consumers. There is no versioned REST API or stable contract.

**How to avoid:**
- Build an abstraction layer between raw Warudo messages and MCP tool logic. Never let tool handlers construct raw WebSocket messages directly.
- Create a `WarudoClient` class that encapsulates all protocol knowledge in one place. When Warudo changes formats, only this class needs updating.
- Pin and document the Warudo version the MCP server is tested against.
- Implement integration tests that verify communication with a real Warudo instance -- these serve as the canary for protocol changes.
- Consider using Warudo's higher-level plugin APIs (WebSocketService pattern) rather than raw message manipulation where possible.

**Warning signs:**
- Tool handlers contain raw JSON message construction inline.
- No abstraction layer between WebSocket messages and business logic.
- No documentation of which Warudo version the server targets.

**Phase to address:**
Phase 1 (Architecture). The abstraction layer must be part of the foundational architecture, not bolted on later.

---

### Pitfall 5: Blueprint Generation Without Validation

**What goes wrong:**
The LLM generates blueprint node graphs from natural language, but produces invalid blueprints -- wrong node type IDs, invalid port connections, incompatible data types on connections, or circular flows. Warudo silently ignores or partially applies the invalid blueprint, leaving the scene in an inconsistent state. The user sees no error but the blueprint does not work.

**Why it happens:**
Blueprint generation is the hardest feature in this project. Warudo blueprints are directed graphs with typed ports. The LLM has no inherent knowledge of valid Warudo node types, their ports, or connection constraints. Without validation, any output the LLM produces gets sent to Warudo verbatim.

**How to avoid:**
- Build a node type registry that knows all available node types, their input/output ports, and port data types. Validate every generated blueprint against this registry before sending to Warudo.
- Provide the LLM with a constrained schema: instead of free-form blueprint JSON, expose a tool that takes structured parameters (node types from an enum, connections as typed pairs).
- Start with blueprint templates for common operations (play animation, trigger expression, set camera) rather than fully generative blueprints.
- Implement a `validate_blueprint` step that checks the graph for: missing required ports, type mismatches, dangling connections, unknown node types.
- Return validation errors to the LLM so it can self-correct.

**Warning signs:**
- Blueprint tool accepts free-form JSON as input.
- No validation step between LLM output and Warudo submission.
- Users report "the blueprint was created but nothing happens."

**Phase to address:**
Phase 2 or 3 (after basic tools work). Blueprint generation is inherently complex and should not be attempted until simpler avatar/scene controls are solid.

---

### Pitfall 6: Ignoring MCP Request Timeouts for Warudo Operations

**What goes wrong:**
The MCP TypeScript SDK enforces a 60-second timeout for tool execution. Some Warudo operations (loading a new scene, importing a complex model, generating a large blueprint) may take longer. The MCP client times out, reports an error, but the Warudo operation continues in the background. The next tool call then encounters Warudo in an unexpected mid-operation state.

**Why it happens:**
Developers test with simple, fast operations during development. Real-world scenes with high-poly models and complex blueprints take significantly longer. The 60-second MCP timeout is not configurable in most clients.

**How to avoid:**
- For potentially long operations, use MCP progress notifications to keep the connection alive. Send periodic progress updates during the operation.
- Design tools to be "fire and verify" rather than synchronous: initiate the Warudo operation, return quickly with an operation ID, provide a separate `check_operation_status` tool.
- Document which operations may be slow and set user expectations in tool descriptions.
- For scene loading specifically, consider a two-step approach: `load_scene` (returns immediately) + `wait_for_scene_ready` (polls).

**Warning signs:**
- Tool handlers that `await` a WebSocket response with no timeout of their own.
- No progress notification implementation.
- Operations that work in test scenes but fail in production scenes.

**Phase to address:**
Phase 2 (Tool Implementation). Must be addressed when building the actual tool handlers, not deferred to polish.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| One tool per API endpoint | Fast to implement, easy mapping | Token bloat, poor LLM accuracy, hits client tool limits | Never -- design coarse tools from the start |
| Inline WebSocket message construction | Quick prototyping | Warudo version changes break every tool handler | Only in spike/prototype, must refactor before v1 |
| No reconnection logic | Simpler initial code | Server becomes useless after any Warudo restart | Never -- reconnection is table stakes |
| Skipping blueprint validation | Ship blueprint feature faster | Silent failures, corrupted scenes, bad user experience | Only for manual/developer use, never for LLM-generated blueprints |
| `console.log` for debugging | Familiar, easy | Corrupts stdio transport, causes mysterious failures | Never in stdio transport -- use stderr from day one |
| Hardcoded Warudo host/port | Works on developer's machine | Breaks for any user with non-default config | Only in earliest prototype, parameterize immediately |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Warudo WebSocket | Connecting once at startup and never reconnecting | Implement reconnection with exponential backoff; check connection state before every operation |
| Warudo WebSocket | Assuming message responses arrive in order | Use message IDs or correlation tokens to match requests with responses; handle out-of-order delivery |
| MCP stdio transport | Writing debug output to stdout | Use stderr exclusively for all logging; configure log libraries to target stderr |
| MCP stdio transport | Not handling Windows PATH issues | Use absolute paths to node executable in MCP client config; document the exact launch command |
| Warudo Blueprint JSON | Trusting LLM-generated JSON structures | Validate against a schema/registry before sending; use Zod schemas for runtime validation |
| Warudo Scene State | Reading state once and caching indefinitely | Scene state changes from user interaction in Warudo; re-query when needed or subscribe to state change events |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Enumerating all scene objects on every tool call | Slow tool responses, Warudo UI stutters | Cache scene state with invalidation on change events; query only what the specific tool needs | Scenes with 50+ props/assets |
| Sending full blueprint JSON in tool responses | Token usage spikes, LLM context window fills up | Return summaries and IDs, not full serialized data; use MCP resources for large data | Blueprints with 20+ nodes |
| No message batching for multi-step operations | Each avatar adjustment is a separate round-trip; high latency for compound actions | Batch related WebSocket messages; expose compound tools ("set pose and expression") | Real-time streaming use cases |
| Synchronous scene queries blocking tool execution | Tool calls queue up, MCP client shows timeouts | Use async WebSocket communication; do not block the event loop | Multiple rapid tool calls |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing file system paths through scene/asset tools | Path traversal could read/write arbitrary files on host | Validate and sanitize all file paths; restrict to Warudo's data directories |
| No input validation on tool parameters | Command injection via crafted tool inputs (e.g., malicious node names in blueprints) | Validate all inputs with Zod schemas; reject unexpected characters in string fields |
| WebSocket connection without origin validation | Other local applications could send commands to Warudo through the MCP server | Bind WebSocket to localhost only; validate connection origin |
| Exposing raw Warudo error messages to LLM | Internal state leakage, potential prompt injection via error content | Sanitize error messages; return generic errors with internal logging for details |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Vague tool descriptions | LLM picks wrong tools or provides wrong parameters; user gets unexpected results | Write tool descriptions as if explaining to a human operator; include parameter examples and constraints |
| No feedback on what changed | User says "make the avatar wave" -- tool returns "success" but no details | Return descriptive results: "Set avatar 'MyAvatar' expression to 'wave' animation on layer 1, duration 2.0s" |
| Requiring Warudo-internal IDs in tool parameters | User must know asset GUIDs or internal node type identifiers | Accept human-readable names and resolve to IDs internally; provide listing tools for discovery |
| Tools that modify state without confirmation context | LLM removes a prop the user wanted to keep | Return current state before destructive changes; design tools to be idempotent where possible |
| No way to undo operations | User asks LLM to "try something" and cannot revert | Implement scene snapshot/restore capability; at minimum, document that changes are immediate and permanent |

## "Looks Done But Isn't" Checklist

- [ ] **WebSocket connection:** Often missing reconnection logic -- verify the server recovers after Warudo restarts
- [ ] **Tool definitions:** Often missing input validation -- verify Zod schemas reject malformed inputs gracefully
- [ ] **stdio transport:** Often missing stderr-only logging -- verify zero bytes hit stdout except JSON-RPC
- [ ] **Blueprint generation:** Often missing validation -- verify generated blueprints are checked against node type registry before submission
- [ ] **Error handling:** Often missing structured MCP errors -- verify tool failures return `isError: true` with helpful messages, not raw exceptions
- [ ] **Scene state queries:** Often missing staleness handling -- verify queries reflect current Warudo state, not cached startup state
- [ ] **Windows compatibility:** Often missing path handling -- verify the server launches correctly from Claude Desktop on Windows with default config
- [ ] **Tool descriptions:** Often missing parameter documentation -- verify every tool parameter has a description and constraints the LLM can understand
- [ ] **Multi-asset scenes:** Often missing disambiguation -- verify tools handle scenes with multiple avatars or same-named props correctly
- [ ] **Connection status:** Often missing status reporting -- verify the LLM can determine if Warudo is connected before attempting operations

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Tool explosion (too many tools) | HIGH | Redesign tool taxonomy from scratch; consolidate into coarse-grained tools; update all tool descriptions and handlers |
| stdout corruption | LOW | Replace all `console.log` with `console.error`; add lint rule; retest stdio transport |
| WebSocket lifecycle bugs | MEDIUM | Add connection state machine and reconnection logic to existing WebSocket wrapper; add health checks |
| Unstable Warudo protocol | MEDIUM | Introduce abstraction layer between WebSocket messages and tool handlers; move all protocol knowledge into one module |
| Invalid blueprints | MEDIUM | Build node type registry and validation layer; add validation step before all blueprint submissions |
| Timeout issues | LOW-MEDIUM | Add progress notifications to long-running tools; implement async operation pattern for slow operations |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Tool explosion | Phase 1 (Architecture) | Tool count under 20; token usage for tool definitions under 4,000 tokens |
| stdout corruption | Phase 1 (Foundation) | stdio transport test passes with Claude Desktop; zero non-JSON-RPC bytes on stdout |
| WebSocket lifecycle | Phase 1 (Foundation) | Server recovers automatically after Warudo restart; tool calls during disconnection return structured errors |
| Unstable protocol | Phase 1 (Architecture) | All Warudo protocol knowledge in single `WarudoClient` module; tool handlers never construct raw messages |
| Blueprint validation | Phase 2-3 (Blueprint tools) | Invalid blueprint JSON rejected before sending; validation errors returned to LLM for self-correction |
| Request timeouts | Phase 2 (Tool implementation) | Long operations use progress notifications; no tool blocks longer than 55 seconds |
| Input validation | Phase 1 (Foundation) | Every tool has Zod schema validation; malformed inputs return helpful error messages |
| Scene state staleness | Phase 2 (Scene tools) | State queries hit Warudo directly or use event-invalidated cache; timestamps on cached data |
| Windows compatibility | Phase 1 (Foundation) | CI or manual test on Windows with Claude Desktop; documented launch configuration |

## Sources

- [State of MCP Server Security 2025 - Astrix](https://astrix.security/learn/blog/state-of-mcp-server-security-2025/) -- MEDIUM confidence
- [MCP Security Survival Guide - Towards Data Science](https://towardsdatascience.com/the-mcp-security-survival-guide-best-practices-pitfalls-and-real-world-lessons/) -- MEDIUM confidence
- [MCP Server Best Practices 2026 - CData](https://www.cdata.com/blog/mcp-server-best-practices-2026) -- MEDIUM confidence
- [MCP "Too Many Tools" Problem](https://demiliani.com/2025/09/04/model-context-protocol-and-the-too-many-tools-problem/) -- HIGH confidence (well-documented issue with client hard limits)
- [10 Strategies to Reduce MCP Token Bloat - The New Stack](https://thenewstack.io/how-to-reduce-mcp-token-bloat/) -- MEDIUM confidence
- [Reducing MCP Token Usage by 100x - Speakeasy](https://www.speakeasy.com/blog/how-we-reduced-token-usage-by-100x-dynamic-toolsets-v2) -- MEDIUM confidence
- [MCP Error -32001 Request Timeout Guide - MCPcat](https://mcpcat.io/guides/fixing-mcp-error-32001-request-timeout/) -- HIGH confidence (observed in multiple MCP implementations)
- [Error Handling in MCP Servers - MCPcat](https://mcpcat.io/guides/error-handling-custom-mcp-servers/) -- MEDIUM confidence
- [Resilient AI Agents with MCP Timeout and Retry - Octopus](https://octopus.com/blog/mcp-timeout-retry) -- MEDIUM confidence
- [WebSocket Architecture Best Practices - Ably](https://ably.com/topic/websocket-architecture-best-practices) -- HIGH confidence
- [MCP stdio Transport Issues on Windows - Roo-Code GitHub](https://github.com/RooCodeInc/Roo-Code/issues/5462) -- HIGH confidence (confirmed Windows-specific issue)
- [MCP Tool Execution Hangs in stdio Mode - Python SDK GitHub](https://github.com/modelcontextprotocol/python-sdk/issues/671) -- MEDIUM confidence (Python-specific but pattern applies)
- [Warudo Handbook - Generating Blueprints](https://docs.warudo.app/docs/scripting/api/generating-blueprints) -- HIGH confidence (official docs)
- [Warudo Handbook - Scene API](https://docs.warudo.app/docs/scripting/api/scene) -- HIGH confidence (official docs)
- [Warudo Handbook - API Overview](https://docs.warudo.app/docs/scripting/api/overview) -- HIGH confidence (official docs)
- [MCP TypeScript SDK - GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- HIGH confidence (official repository)

---
*Pitfalls research for: MCP server for Warudo (3D VTubing software)*
*Researched: 2026-03-09*
