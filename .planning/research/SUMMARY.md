# Project Research Summary

**Project:** WarudoMCP -- MCP server for Warudo 3D VTubing software
**Domain:** AI-to-3D-application bridge server (Model Context Protocol)
**Researched:** 2026-03-09
**Confidence:** MEDIUM

## Executive Summary

WarudoMCP is a bridge server that connects AI assistants (Claude Desktop, Cursor) to Warudo, a 3D VTubing application, via the Model Context Protocol. The established pattern for this type of tool is a single-process Node.js server that speaks MCP over stdio on one side and WebSocket to the target application on the other. Comparable projects (Blender MCP, Unity MCP) validate this architecture and show that 20-50 well-designed tools provide comprehensive 3D application control. The user's existing Warudo modding experience (OBSBOT Tail 2 FreeD mod) with Warudo's Node/Asset systems, DataInput/DataOutput patterns, and sandbox scripting is a significant advantage that will accelerate tool design and blueprint generation work.

The recommended approach is to build incrementally: start with WebSocket protocol discovery and a minimal MCP skeleton, then layer on read-only scene queries, then avatar/camera/prop mutation tools, and finally the blueprint generation engine. The stack is straightforward -- TypeScript on Node.js 22 LTS, MCP SDK v1, ws for WebSocket, Zod 3.25+ for schemas. No database, no bundler, no exotic dependencies. The critical architectural decision is tool granularity: design coarse-grained, domain-grouped tools (8-15 total for v1) rather than one-tool-per-endpoint, because LLMs degrade badly with 40+ tools and some clients enforce hard limits.

The single biggest risk is the undocumented Warudo WebSocket protocol. Warudo's external WebSocket API is not publicly specified -- the documentation covers the C# plugin SDK, not the wire format for external consumers. Phase 1 must include hands-on protocol discovery against a running Warudo instance before committing to a feature set. The user's familiarity with Warudo internals mitigates this significantly but does not eliminate the need for systematic protocol mapping. Secondary risks include stdout corruption (fatal for stdio MCP transport) and blueprint validation (invalid generated graphs fail silently in Warudo).

## Key Findings

### Recommended Stack

The stack is mature and well-established with high confidence across all choices. Node.js 22 LTS provides the runtime, TypeScript 5.9 adds type safety, and the MCP SDK v1 (@modelcontextprotocol/sdk ^1.27.x) is the production-standard framework with 31K+ downstream packages. Use v1 explicitly -- v2 is pre-alpha and not ready. The `ws` library handles WebSocket communication to Warudo (port 19190), chosen over Node.js native WebSocket for its ping/pong control and reconnection support.

**Core technologies:**
- **Node.js 22 LTS + TypeScript 5.9:** Runtime and language -- current LTS, battle-tested, ES2022 target
- **@modelcontextprotocol/sdk v1.27+:** MCP server framework -- single stable package, v2 migration later
- **Zod 3.25+:** Schema validation -- required MCP SDK peer dependency, not optional
- **ws ^8.19:** WebSocket client to Warudo -- mature, full connection lifecycle control
- **pino (stderr only):** Structured logging -- stdout is reserved exclusively for MCP JSON-RPC
- **tsc (no bundler):** Build tool -- MCP servers are CLI tools, bundlers add unnecessary complexity

### Expected Features

**Must have (table stakes):**
- WebSocket connection management (connect, reconnect, status) -- foundation for everything
- Scene asset listing and state reading -- AI needs context before acting
- Avatar expression and animation control -- core VTubing use case
- Camera control (position, FOV, switching) -- fundamental 3D control
- Prop manipulation (create, position, attach to character) -- core scene interaction
- Error handling with structured MCP responses -- prevents AI hallucinating success
- Well-described tool schemas -- determines AI usability

**Should have (v1.x after validation):**
- Blueprint CRUD (list, enable/disable, delete) -- automation management
- Lighting, post-processing, environment control -- mood and atmosphere
- Character IK and ragdoll/physics triggers -- reactive VTubing interactions
- MCP resources and prompts -- richer AI context beyond just tools

**Defer (v2+):**
- Blueprint generation from natural language -- the killer differentiator but HIGH complexity; needs stable tool foundation and complete node type catalog first
- Bulk scene operations -- requires stable individual tools to compose
- Motion capture state management -- unclear what is externally accessible

### Architecture Approach

The system is a three-layer bridge: MCP Protocol Layer (stdio JSON-RPC), Tool Registry (Zod-schema-defined tools grouped by domain), and Warudo Client (WebSocket with correlation IDs and reconnection). Tool definitions must be purely declarative so schemas can be exported as JSON Schema files for future C# plugin reuse. Each tool is a standalone module (schema + description + handler), auto-discovered by the registry.

**Major components:**
1. **MCP Protocol Layer** -- handles stdio JSON-RPC, capability negotiation, routes to tool handlers
2. **Tool Registry** -- defines tools with Zod schemas, dispatches validated arguments, groups by domain (avatar, scene, camera, blueprint)
3. **Warudo Client** -- WebSocket connection management, message serialization, request-response correlation via IDs, exponential backoff reconnection
4. **Blueprint Generation Engine** -- (Phase 4) translates structured descriptions into Warudo graph JSON with validation
5. **Schema Export Module** -- extracts tool Zod schemas to JSON Schema files for C# plugin consumption

### Critical Pitfalls

1. **Tool explosion overwhelming LLM context** -- Design coarse-grained tools with action discriminators from day one. Target 8-15 tools for v1, not 50+. Cursor caps at 40, and LLM accuracy degrades well before that. Recovery cost is HIGH (full tool redesign).
2. **stdout corruption killing the MCP connection** -- Never use console.log anywhere. All logging to stderr via pino. Add a lint rule. Test stdio transport from day one with an actual MCP client.
3. **WebSocket lifecycle mismanagement** -- Implement reconnection with exponential backoff, explicit connection state tracking, and graceful error returns when Warudo is unreachable. Warudo restarts during streams are normal.
4. **Treating Warudo's internal protocol as stable API** -- Isolate all protocol knowledge in the WarudoClient class. Pin and document the target Warudo version. Tool handlers must never construct raw WebSocket messages.
5. **Blueprint generation without validation** -- Build a node type registry, validate all generated blueprints before submission, start with templates for common patterns before attempting fully generative blueprints.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Protocol Discovery
**Rationale:** Everything depends on talking to Warudo, and the WebSocket protocol is the biggest unknown. The user's Warudo modding experience makes protocol discovery faster but it still must be systematic. Establish logging discipline and stdio transport correctness from line one.
**Delivers:** Working MCP server skeleton connected to Warudo via WebSocket; documented wire protocol; project scaffolding with TypeScript/build config
**Addresses:** WebSocket connection management, error handling foundation, tool discovery schema
**Avoids:** stdout corruption (enforce stderr-only from start), WebSocket lifecycle bugs (build reconnection into foundation), protocol instability (abstraction layer in WarudoClient)

### Phase 2: Read-Only Scene Tools
**Rationale:** Read before write. Validate protocol understanding with safe, non-destructive queries. Scene state reading is a prerequisite for all mutation tools (AI needs context). Low risk -- if reads work, the protocol is understood.
**Delivers:** Scene asset listing, property reading, connection status tool. AI can inspect a Warudo scene.
**Addresses:** Scene asset listing/discovery, read scene state
**Avoids:** Scene state staleness (query Warudo directly, no caching yet), tool explosion (use coarse-grained `scene_query` tool with action parameter)

### Phase 3: Avatar, Camera, and Prop Control
**Rationale:** These are the core VTubing controls and the primary value proposition. Group them because they share the same mutation pattern (identify asset, set property). The user's existing knowledge of CharacterAsset, CameraAsset, and the Node system accelerates this phase.
**Delivers:** Expression/animation control, camera positioning/switching, prop creation/attachment. The product is usable for basic VTubing AI control.
**Addresses:** Avatar expression control, avatar animation control, camera control, prop manipulation
**Avoids:** Tool explosion (group avatar operations under one tool, camera under another), request timeouts (add progress notifications for slow operations)

### Phase 4: Extended Scene Control
**Rationale:** Lighting, post-processing, environment, IK, and ragdoll are lower priority but follow the same patterns established in Phase 3. These can be added incrementally.
**Delivers:** Full scene atmosphere control, reactive character behaviors, physics triggers
**Addresses:** Lighting, post-processing, environment switching, character IK, ragdoll, screen/overlay management
**Avoids:** Scope creep (each is small and independent; ship incrementally)

### Phase 5: Blueprint Engine
**Rationale:** Blueprint generation is the killer differentiator but depends on deep understanding of Warudo's node type system, which is built up during Phases 2-4. Start with CRUD operations, then templates, then constrained generation. The user's familiarity with NodeType, DataInput, DataOutput, Trigger, and FlowOutput attributes is a major advantage here.
**Delivers:** Blueprint listing/enable/disable, template-based creation, eventually natural-language blueprint generation
**Addresses:** Blueprint CRUD, blueprint generation from natural language
**Avoids:** Blueprint validation failures (build node type registry and validate before submission), treating JSON export as stable (abstract the format)

### Phase 6: Schema Export and Polish
**Rationale:** Schema export for C# plugin reuse should come after tool definitions stabilize. Exporting a moving target wastes effort.
**Delivers:** JSON Schema files for all tools, documentation, error handling hardening, MCP resources/prompts
**Addresses:** Schema export module, resource/prompt support, Warudo plugin bridge preparation

### Phase Ordering Rationale

- **Protocol discovery first** because all features depend on WebSocket communication with Warudo, and the wire format is undocumented. This is the riskiest unknown.
- **Read before write** because safe queries validate the protocol before mutations risk corrupting scene state.
- **Core VTubing controls before extended controls** because expression/animation/camera deliver the most user value per effort.
- **Blueprints after individual tools** because blueprint generation requires understanding the node type system, which is learned through building individual controls.
- **Schema export last** because tool definitions must stabilize before export is useful.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** NEEDS RESEARCH -- Warudo WebSocket wire protocol is undocumented. Must connect to a running instance and map the message format before designing tool commands. The user's modding experience helps but systematic documentation is required.
- **Phase 5:** NEEDS RESEARCH -- Blueprint node type catalog, port compatibility rules, and connection constraints need to be cataloged. The user's knowledge of NodeType/DataInput/DataOutput/FlowOutput patterns from existing mods provides a strong foundation but completeness must be verified.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Standard MCP tool patterns, well-documented SDK. Scene query is a straightforward request-response.
- **Phase 3:** Established patterns from Phase 2; avatar/camera/prop control follows the same abstraction. The user's Warudo Asset system knowledge covers this.
- **Phase 4:** Same patterns as Phase 3, just more asset types.
- **Phase 6:** JSON Schema export from Zod is well-documented (zod-to-json-schema library).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are mature, well-documented, and standard for MCP servers. No controversial choices. |
| Features | MEDIUM | Feature list is solid based on comparable MCP servers, but actual Warudo API coverage depends on protocol discovery. Some features may not be externally accessible. |
| Architecture | MEDIUM-HIGH | Three-layer bridge pattern is proven. Tool registry and schema-first design are standard. Warudo Client abstraction is the right call. Uncertainty is in the Warudo communication model specifics. |
| Pitfalls | HIGH | Pitfalls are well-documented across MCP ecosystem. Tool explosion, stdout corruption, and WebSocket lifecycle issues are confirmed problems with known solutions. |

**Overall confidence:** MEDIUM

The stack and architecture are solid, but the project's success hinges on Warudo's WebSocket protocol being rich enough to support the planned feature set. If the external API only supports simple message triggers (not structured asset queries/mutations), the scope will need significant adjustment toward a plugin-mediated model.

### Gaps to Address

- **Warudo WebSocket wire protocol:** The exact JSON message format for external WebSocket commands is not documented. Must be reverse-engineered in Phase 1. This is the single biggest gap.
- **Port 19190 validation:** Referenced as the WebSocket port but only confirmed in one source. Needs hands-on verification.
- **Blueprint JSON import format stability:** Warudo docs call the JSON format "hacky and not recommended." Need to assess if this is viable for external blueprint generation or if a plugin-mediated approach is needed.
- **External vs. internal API surface:** It is unclear which Warudo operations are available via external WebSocket versus only through the internal C# API. Phase 1 must map this boundary.
- **Node type catalog completeness:** Blueprint generation needs a complete catalog of available node types, their ports, and connection rules. This depends on installed plugins and may vary per user.

## Sources

### Primary (HIGH confidence)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- SDK architecture, tool registration, stdio transport
- [MCP Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server) -- Official server construction guide
- [MCP Tool Schema specification](https://modelcontextprotocol.io/specification/draft/server/tools) -- Tool definition format
- [ws npm package](https://www.npmjs.com/package/ws) -- WebSocket client capabilities
- [Warudo Handbook - Scripting API](https://docs.warudo.app/docs/scripting/api/overview) -- C# SDK, entity types, internal architecture
- [Warudo Handbook - Generating Blueprints](https://docs.warudo.app/docs/scripting/api/generating-blueprints) -- Graph API, JSON import (called "hacky")
- [Warudo Handbook - Nodes, Ports, Assets](https://docs.warudo.app/docs/scripting/api/nodes) -- Node type system, port types, lifecycle

### Secondary (MEDIUM confidence)
- [Blender MCP](https://github.com/ahujasid/blender-mcp) -- Comparable MCP server architecture and tool count reference
- [Unity MCP](https://github.com/CoderGamester/mcp-unity) -- Comparable MCP server for Unity Editor
- [MCP "Too Many Tools" Problem](https://demiliani.com/2025/09/04/model-context-protocol-and-the-too-many-tools-problem/) -- Tool explosion limits and mitigation
- [Warudo Steam Discussion](https://steamcommunity.com/app/2079120/discussions/0/3812908540893823781/) -- Confirms WebSocket as external control path, no REST API
- [MCP Security and Best Practices](https://www.cdata.com/blog/mcp-server-best-practices-2026) -- Server security patterns

### Tertiary (LOW confidence)
- Warudo WebSocket message format -- inferred from C# SDK docs and community discussion, needs hands-on validation
- Port 19190 as WebSocket endpoint -- single source, needs verification against running Warudo instance
- Blueprint JSON import reliability -- docs warn against it, real-world stability unknown

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
