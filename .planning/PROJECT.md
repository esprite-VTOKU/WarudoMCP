# WarudoMCP

## What This Is

A two-component system for AI-driven control of Warudo, the 3D VTubing software:

1. **TypeScript MCP server** — connects to Warudo's WebSocket/REST APIs, exposes MCP tools for avatar control, scene management, and blueprint generation
2. **C# Warudo companion plugin** — extends Warudo's API surface (e.g., full node type registry), provides in-Warudo UI for MCP configuration and control

Both live in this monorepo. The plugin is compiled separately in a Warudo mod project.

## Core Value

AI assistants can fully control Warudo — manipulating avatars, scenes, and generating blueprints — through an MCP server and companion Warudo plugin that work together to expose the full Warudo API surface.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Full Warudo WebSocket API coverage exposed as MCP tools
- [ ] Avatar control (expressions, animations, poses, motion)
- [ ] Scene management (props, camera, lighting, environment)
- [ ] Blueprint generation — create any valid Warudo blueprint from natural language descriptions
- [ ] Read scene state (query current avatar, props, camera, environment)
- [ ] stdio transport for standard MCP client compatibility (Claude Desktop, Cursor, etc.)
- [ ] Companion Warudo C# plugin that exposes internal APIs (node type registry, blueprint internals) via WebSocket
- [ ] In-Warudo UI for MCP connection configuration and control
- [ ] Plugin connects Warudo directly to Claude API for Warudo-initiated AI interactions
- [ ] Architecture designed so the plugin and MCP server share tool definitions

### Out of Scope

- SSE transport — stdio sufficient for v1
- Custom UI on the MCP server side — the server is headless (Warudo-side UI is in the companion plugin)

## Context

- Warudo is a Unity-based 3D VTubing application with a built-in WebSocket API
- Warudo uses a blueprint system (visual node graphs) for automation and logic
- MCP is an open protocol by Anthropic for connecting AI assistants to external tools
- The official MCP TypeScript SDK will be used
- Primary use cases: AI VTubing (real-time avatar control during streams) and scene authoring (natural language scene setup and tweaking)
- A companion C# Warudo plugin lives in this repo (under `warudo-plugin/`) but is compiled separately in a Warudo mod project
- The plugin exposes internal Warudo APIs that the external WebSocket can't reach and provides in-Warudo MCP controls

## Constraints

- **Transport**: stdio (standard MCP transport)
- **Language**: TypeScript with official MCP SDK
- **Connection**: WebSocket client connecting to Warudo's built-in WebSocket server
- **Compatibility**: Must work with Claude Desktop, Cursor, and other MCP clients

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript over C# | Most MCP servers use TS SDK; matches ecosystem conventions | — Pending |
| stdio transport | Standard MCP transport, broadest client support | — Pending |
| WebSocket connection to Warudo | Uses Warudo's built-in API for base connectivity | — Pending |
| Full API coverage for v1 | User wants comprehensive control, not a subset | — Pending |
| Monorepo with separate builds | C# plugin in same repo, compiled in Warudo mod project | — Decided |
| Plugin connects Warudo to Claude | Plugin can call Claude API directly from inside Warudo | — Decided |

---
*Last updated: 2026-03-09 after initialization*
