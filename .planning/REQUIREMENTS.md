# Requirements: WarudoMCP

**Defined:** 2026-03-09
**Core Value:** AI assistants can fully control Warudo — manipulating avatars, scenes, and generating blueprints — through a standards-compliant MCP server.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Connection

- [x] **CONN-01**: MCP server connects to Warudo WebSocket API on configurable host:port (default ws://localhost:19053)
- [x] **CONN-02**: MCP server connects to Warudo REST API on configurable host:port (default http://localhost:19052)
- [x] **CONN-03**: Server reports clear error messages when Warudo is unreachable or disconnects

### Scene Inspection

- [x] **SCNE-01**: User can list all assets in the current scene with their types and IDs
- [x] **SCNE-02**: User can read any asset's data input port values by entity ID
- [x] **SCNE-03**: User can get Warudo version info, loaded plugins, and available scenes

### Asset Control

- [ ] **CTRL-01**: User can set any asset's data input port value by entity ID, port key, and value
- [ ] **CTRL-02**: User can invoke any trigger port on an asset or node by entity ID and port key
- [ ] **CTRL-03**: User can send messages to Warudo plugins via sendPluginMessage with plugin ID, action, and payload

### Blueprint Generation

- [ ] **BPRT-01**: User can create new blueprint graphs with specified nodes and connections
- [ ] **BPRT-02**: User can list, enable, disable, and remove existing blueprint graphs
- [ ] **BPRT-03**: User can generate blueprints from natural language descriptions of desired behavior

## v2 Requirements

### Connection Resilience

- **CONN-04**: Auto-reconnect with exponential backoff on WebSocket disconnect
- **CONN-05**: Connection health monitoring and status reporting
- **CONN-06**: Multi-instance support (connect to multiple Warudo instances)

### Advanced Scene

- **SCNE-04**: Asset search and filter by type
- **SCNE-05**: Scene state diffing (compare before/after)

### Advanced Control

- **CTRL-04**: Expression layering and sequencing
- **CTRL-05**: Camera animation transitions (smooth moves between positions)
- **CTRL-06**: Prop spawning from Warudo resource library

### Advanced Blueprints

- **BPRT-04**: Template-based blueprint creation (common patterns as presets)
- **BPRT-05**: Blueprint validation before import (check node types, port compatibility)

### Plugin Ecosystem

- **PLGN-01**: Plugin discovery and capability listing
- **PLGN-02**: Schema export for C# plugin reuse (JSON Schema from Zod definitions)

## Out of Scope

| Feature | Reason |
|---------|--------|
| SSE/HTTP transport | stdio sufficient for v1; broadest MCP client support |
| Warudo C# plugin | Future project, not part of MCP server |
| Custom GUI/dashboard | Headless MCP server, no UI needed |
| Real-time streaming data | MCP is request-response, not streaming |
| Direct blend shape manipulation | Use Warudo's built-in nodes via blueprints instead |
| Motion capture passthrough | Complex real-time pipeline, use Warudo's native mocap |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 1: MCP Server Foundation | Complete |
| CONN-02 | Phase 1: MCP Server Foundation | Complete |
| CONN-03 | Phase 1: MCP Server Foundation | Complete |
| SCNE-01 | Phase 2: Scene Inspection | Complete |
| SCNE-02 | Phase 2: Scene Inspection | Complete |
| SCNE-03 | Phase 2: Scene Inspection | Complete |
| CTRL-01 | Phase 3: Asset Control | Pending |
| CTRL-02 | Phase 3: Asset Control | Pending |
| CTRL-03 | Phase 3: Asset Control | Pending |
| BPRT-01 | Phase 4: Blueprint CRUD | Pending |
| BPRT-02 | Phase 4: Blueprint CRUD | Pending |
| BPRT-03 | Phase 5: Blueprint Intelligence | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after 02-02 completion*
