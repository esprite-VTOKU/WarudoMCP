# Roadmap: WarudoMCP

## Overview

WarudoMCP delivers AI control over Warudo through five phases: establish the MCP server foundation with WebSocket and REST connectivity, then layer on read-only scene inspection, then asset mutation tools, then blueprint generation, and finally blueprint intelligence (natural language to blueprint). Each phase delivers a complete, verifiable capability that builds on the previous. The WebSocket protocol is documented (port 19053) and the REST API is known (port 19052), so Phase 1 focuses on building a solid MCP skeleton rather than protocol discovery.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: MCP Server Foundation** - Project scaffolding, WebSocket/REST clients, stdio transport, error handling
- [x] **Phase 2: Scene Inspection** - Read-only tools for querying scene state, assets, and server info
- [x] **Phase 3: Asset Control** - Mutation tools for setting values, invoking triggers, and messaging plugins
- [ ] **Phase 4: Blueprint CRUD** - Create, list, enable, disable, and remove blueprint graphs
- [x] **Phase 5: Blueprint Intelligence** - Natural language to blueprint generation
- [ ] **Phase 6: Warudo Companion Plugin** - C# plugin exposing internal APIs, in-Warudo MCP controls, and direct Claude connection

## Phase Details

### Phase 1: MCP Server Foundation
**Goal**: A running MCP server that connects to Warudo over WebSocket and REST, speaks stdio JSON-RPC, and handles connection failures gracefully
**Depends on**: Nothing (first phase)
**Requirements**: CONN-01, CONN-02, CONN-03
**Success Criteria** (what must be TRUE):
  1. MCP server starts via stdio and completes capability negotiation with an MCP client (Claude Desktop or mcp-inspector)
  2. Server establishes WebSocket connection to Warudo on configurable host:port (default ws://localhost:19053)
  3. Server establishes REST connection to Warudo on configurable host:port (default http://localhost:19052)
  4. When Warudo is unreachable or disconnects, MCP tool calls return clear, structured error messages (not crashes or timeouts)
  5. All logging goes to stderr only -- stdout is reserved exclusively for MCP JSON-RPC
**Plans:** 2/2 plans complete

Plans:
- [x] 01-01-PLAN.md -- Project scaffolding + Warudo connection clients (WebSocket + REST)
- [x] 01-02-PLAN.md -- MCP server entry point, tool registration, build verification

### Phase 2: Scene Inspection
**Goal**: AI assistants can read and understand the current state of a Warudo scene -- what assets exist, what their properties are, and what Warudo instance is running
**Depends on**: Phase 1
**Requirements**: SCNE-01, SCNE-02, SCNE-03
**Success Criteria** (what must be TRUE):
  1. User can ask the AI to list all assets in the current Warudo scene and receives names, types, and entity IDs
  2. User can ask the AI to read any specific asset's data input port values by providing its entity ID
  3. User can ask the AI what Warudo version is running, what plugins are loaded, and what scenes are available
  4. Scene inspection tools work without modifying any scene state (read-only guarantee)
**Plans:** 2/2 plans complete

Plans:
- [x] 02-01-PLAN.md -- Server info, scene listing, and asset listing tools (REST + WebSocket)
- [x] 02-02-PLAN.md -- Asset detail inspection tool (read asset data input ports by entity ID)

### Phase 3: Asset Control
**Goal**: AI assistants can modify Warudo scene state -- setting asset properties, triggering actions, and communicating with plugins
**Depends on**: Phase 2
**Requirements**: CTRL-01, CTRL-02, CTRL-03
**Success Criteria** (what must be TRUE):
  1. User can ask the AI to change any asset's data input port value (e.g., move a prop, change a character expression, adjust camera FOV) and see the change reflected in Warudo
  2. User can ask the AI to invoke any trigger port on an asset or node (e.g., play an animation, take a screenshot) and observe the triggered action in Warudo
  3. User can ask the AI to send a message to a Warudo plugin with a specific plugin ID, action, and payload, and the plugin receives it
**Plans:** 1/1 plans complete

Plans:
- [x] 03-01-PLAN.md -- Asset mutation tools (set_data_input, invoke_trigger, send_plugin_message)

### Phase 4: Blueprint CRUD
**Goal**: AI assistants can manage Warudo blueprints -- creating graphs with specified nodes and connections, and managing the lifecycle of existing graphs
**Depends on**: Phase 3
**Requirements**: BPRT-01, BPRT-02
**Success Criteria** (what must be TRUE):
  1. User can ask the AI to create a new blueprint graph with specified node types, data connections, and flow connections, and the graph appears and functions in Warudo
  2. User can ask the AI to list all existing blueprint graphs in the scene
  3. User can ask the AI to enable, disable, or remove an existing blueprint graph
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Blueprint Intelligence
**Goal**: AI assistants can generate Warudo blueprints from natural language descriptions of desired behavior, without the user needing to know node types or connection rules
**Depends on**: Phase 4
**Requirements**: BPRT-03
**Success Criteria** (what must be TRUE):
  1. User can describe a desired behavior in natural language (e.g., "when I press spacebar, make the character wave") and the AI generates and imports a working blueprint into Warudo
  2. Generated blueprints use correct node types, valid port connections, and proper data/flow wiring
  3. When a blueprint description is ambiguous or references unknown capabilities, the AI asks clarifying questions or explains what is not possible rather than generating invalid graphs
**Plans**: 2/2 plans complete

Plans:
- [x] 05-01-PLAN.md -- Node type extraction tool (list_node_types) and helpers
- [x] 05-02-PLAN.md -- MCP node catalog resource, index.ts integration, enhanced descriptions

### Phase 6: Warudo Companion Plugin
**Goal**: A C# Warudo plugin that exposes internal APIs the external WebSocket can't reach, provides in-Warudo UI for MCP configuration, and connects Warudo directly to Claude
**Depends on**: Phase 3 (uses plugin messaging), Phase 4/5 benefit from it
**Requirements**: PLGN-03, PLGN-04, PLGN-05
**Success Criteria** (what must be TRUE):
  1. Plugin exposes the full node type registry (all available node types including plugin-installed ones) via WebSocket endpoint
  2. Plugin provides a Warudo-side UI panel to configure MCP connection settings (host, port, status)
  3. Plugin can connect to Claude API directly from within Warudo, enabling Warudo-initiated AI interactions
  4. Plugin lives in `warudo-plugin/` directory and compiles separately in a Warudo mod project
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. MCP Server Foundation | 2/2 | Complete    | 2026-03-09 |
| 2. Scene Inspection | 2/2 | Complete    | 2026-03-09 |
| 3. Asset Control | 1/1 | Complete    | 2026-03-09 |
| 4. Blueprint CRUD | 0/TBD | Not started | - |
| 5. Blueprint Intelligence | 2/2 | Complete    | 2026-03-09 |
| 6. Warudo Companion Plugin | 0/TBD | Not started | - |
