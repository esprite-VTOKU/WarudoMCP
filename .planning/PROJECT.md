# WarudoMCP

## What This Is

An MCP (Model Context Protocol) server that gives AI assistants full control over Warudo, the 3D VTubing software. It connects to Warudo's WebSocket API and exposes every available endpoint as MCP tools — enabling AI-driven avatar control, scene management, and blueprint generation through natural language.

## Core Value

AI assistants can fully control Warudo — manipulating avatars, scenes, and generating blueprints — through a standards-compliant MCP server that any MCP client can connect to.

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
- [ ] Architecture designed so a future Warudo plugin can reuse tool definitions and connect to Claude directly from inside Warudo

### Out of Scope

- Warudo plugin development — planned for future but not part of this project
- SSE transport — stdio sufficient for v1
- Custom UI — this is a headless MCP server

## Context

- Warudo is a Unity-based 3D VTubing application with a built-in WebSocket API
- Warudo uses a blueprint system (visual node graphs) for automation and logic
- MCP is an open protocol by Anthropic for connecting AI assistants to external tools
- The official MCP TypeScript SDK will be used
- Primary use cases: AI VTubing (real-time avatar control during streams) and scene authoring (natural language scene setup and tweaking)
- The architecture must accommodate a future Warudo C# plugin that connects to Claude, reusing the same tool definitions/schema

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
| WebSocket connection to Warudo | Uses Warudo's built-in API, no plugin required | — Pending |
| Full API coverage for v1 | User wants comprehensive control, not a subset | — Pending |
| Architecture supports future plugin | Tool definitions should be reusable from a Warudo C# plugin | — Pending |

---
*Last updated: 2026-03-09 after initialization*
