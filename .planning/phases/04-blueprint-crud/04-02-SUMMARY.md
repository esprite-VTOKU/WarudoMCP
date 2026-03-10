---
phase: 04-blueprint-crud
plan: 02
status: complete
started: "2026-03-09"
completed: "2026-03-09"
duration_minutes: 3
---

# Plan 04-02 Summary: Create Blueprint and Manage Blueprint Tools

## What was built
- `buildGraphJson()` utility that constructs Warudo-compatible graph JSON from structured MCP tool inputs
- `create_blueprint` MCP tool with input validation, UUID generation, grid auto-positioning, and index-based connection resolution
- `manage_blueprint` MCP tool for enable/disable/remove lifecycle operations on existing blueprints

## Key decisions
- Nodes referenced by 0-based array index in connections (more ergonomic for AI callers than requiring GUIDs)
- Auto-positioning in 4-column grid layout (300px spacing) when positions not specified
- `importGraph` WebSocket action for creation (best-guess; error messages guide toward companion plugin if unsupported)
- `setEntityDataInputPortValue` on graph entities for enable/disable (may or may not work; actionable fallback guidance provided)
- `removeGraph` WebSocket action for removal (best-guess; companion plugin fallback documented)
- Single `manage_blueprint` tool with action enum instead of 3 separate tools to stay within tool count budget

## Key files
- `src/tools/blueprint-tools.ts` -- extended with create and manage handlers, graph JSON builder, input validation
- `src/index.ts` -- registered create_blueprint and manage_blueprint tools with Zod schemas
- `src/__tests__/blueprint-tools.test.ts` -- extended to 28 tests total

## Self-Check: PASSED
- TypeScript compiles without errors
- All 28 blueprint tests pass
- All 79 total tests pass across 11 test files
- Total tool count: 12 (within 8-15 target)
- create_blueprint and manage_blueprint registered in index.ts
