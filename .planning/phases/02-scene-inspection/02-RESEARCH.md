# Phase 2: Scene Inspection - Research

**Researched:** 2026-03-09
**Domain:** Read-only MCP tools for querying Warudo scene state (assets, properties, server info)
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Read-only MCP tools for querying Warudo scene state
- Users can list assets, read asset properties, and get server info
- No scene mutations -- that's Phase 3

### Claude's Discretion
- Tool granularity -- Claude decides how to split tools (per-endpoint, coarse-grained, or hybrid). Research pitfall: keep total tool count manageable (8-15 across all phases).
- Response format -- Claude decides how to structure asset data in tool responses. Should be useful for AI consumption (clear, parseable, not overwhelming).
- Asset filtering -- Claude decides whether list_assets supports type filtering or returns everything. Consider what's most useful for AI assistants.
- Tool naming conventions -- Claude picks names that are clear and consistent.
- Error messages for read-only operations -- follow Phase 1 patterns (actionable errors with guidance).

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCNE-01 | User can list all assets in the current scene with their types and IDs | WebSocket `getScene` action returns full scene JSON including asset list with entity IDs, types, and names; REST GET /api/scenes lists available scene files |
| SCNE-02 | User can read any asset's data input port values by entity ID | WebSocket `getEntityDataInputPortValue` action retrieves specific port values; alternatively `getScene` returns all asset data including port values |
| SCNE-03 | User can get Warudo version info, loaded plugins, and available scenes | REST GET /api/about returns version and plugin info; REST GET /api/scenes returns scene list; WebSocket can supplement with runtime details |
</phase_requirements>

## Summary

Phase 2 adds read-only scene inspection tools to the MCP server. The implementation uses two communication channels already established in Phase 1: the WebSocket client (port 19053) and the REST client (port 19052). The REST API covers server metadata (version, plugins, scenes) while the WebSocket API provides scene state queries (asset listing, property reading).

The Warudo WebSocket protocol for external control is not fully documented publicly. The editor-runtime protocol uses WebSocket internally, and the user's SDK reference documents specific actions: `setEntityDataInputPortValue`, `invokeEntityTriggerPort`, and `sendPluginMessage`. For scene inspection, the corresponding read operations should include getting the scene state (asset list with properties) and reading individual entity data input port values. The exact wire format needs validation against a running Warudo instance.

**Primary recommendation:** Implement 3-4 focused MCP tools: `get_server_info` (REST-based), `list_assets` (WebSocket-based), `get_asset_details` (WebSocket-based), and optionally `list_scenes` (REST-based). Keep tools coarse-grained to minimize total tool count across phases. The REST endpoints are well-understood and can be implemented with high confidence; WebSocket scene queries carry medium confidence and should include defensive error handling.

## Standard Stack

### Core (already installed from Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.27.x | MCP tool registration | Already in use; tools follow `server.tool()` pattern |
| ws | ^8.19.x | WebSocket client to Warudo | Already in use; `wsClient.send()` for scene queries |
| zod | ^3.25.x | Tool input schema validation | Already in use; define input schemas for new tools |

### No New Dependencies Needed

Phase 2 requires no new npm packages. All scene inspection tools use the existing WebSocket client and REST client from Phase 1. Tool registration uses the established `server.tool()` pattern with Zod schemas.

## Architecture Patterns

### Recommended Project Structure (additions to Phase 1)

```
src/
  index.ts              # Add new tool registrations alongside ping/check_connection
  warudo/
    websocket-client.ts # Existing -- may need new convenience methods
    rest-client.ts      # Existing -- already has getAbout() and getScenes()
    types.ts            # Add response types for scene data
  errors.ts             # Existing -- reuse warudoError() pattern
```

### Pattern 1: Tool Registration in index.ts

**What:** Register new scene inspection tools directly in index.ts alongside existing ping and check_connection tools.
**When:** Phase 2 (keep it simple; refactor to tool registry when tool count grows in Phase 3+).

```typescript
// Add to src/index.ts
server.tool(
  "get_server_info",
  "Get Warudo version, loaded plugins, and server status",
  {},
  async () => {
    try {
      const about = await restClient.getAbout();
      return {
        content: [{ type: "text", text: JSON.stringify(about, null, 2) }],
      };
    } catch (err) {
      return warudoError(`Failed to get server info: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
);
```

### Pattern 2: WebSocket Scene Query

**What:** Send a scene query action via WebSocket and parse the response to extract asset information.
**When:** list_assets and get_asset_details tools.

The WebSocket client already supports `send()` with action-based messages. Scene inspection tools send read-only query actions:

```typescript
// Query scene state via WebSocket
const response = await wsClient.send({
  action: "getScene",
});
// Response should contain asset list with types, IDs, names

// Query specific entity data
const response = await wsClient.send({
  action: "getEntityDataInputPortValue",
  entityId: "some-uuid",
  dataInputPortKey: "SomeProperty",
});
```

**IMPORTANT:** The exact WebSocket action names and response format need validation against a running Warudo instance. The actions listed above are based on the user's SDK reference. The implementation should handle unexpected response formats gracefully.

### Pattern 3: Response Formatting for AI Consumption

**What:** Format scene data as structured, parseable text rather than raw JSON dumps. AI assistants work best with concise, organized data.
**When:** All tool responses.

```typescript
// Good: structured for AI consumption
const assetSummary = assets.map(a =>
  `- ${a.name} (${a.type}) [ID: ${a.id}]${a.active ? "" : " [inactive]"}`
).join("\n");

return {
  content: [{ type: "text", text: `Scene: ${sceneName}\n\nAssets (${assets.length}):\n${assetSummary}` }],
};

// Bad: raw JSON dump that overwhelms AI context
return {
  content: [{ type: "text", text: JSON.stringify(fullSceneData) }],
};
```

### Anti-Patterns to Avoid

- **Returning full scene JSON as-is:** Warudo scenes can be large. Filter and summarize for AI consumption.
- **One tool per property:** Don't create get_asset_name, get_asset_type, get_asset_position as separate tools. Use one `get_asset_details` tool that returns all relevant properties.
- **Forgetting error handling:** Every tool must catch errors and return `warudoError()` -- never throw from tool handlers.
- **Breaking the read-only guarantee:** Phase 2 tools must NEVER call any set/write/invoke actions. This is a hard boundary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| REST API calls | Custom fetch wrappers | Existing `WarudoRestClient` | Already built and tested in Phase 1 |
| WebSocket messaging | Direct ws.send() calls | Existing `WarudoWebSocketClient.send()` | Handles connection, correlation, timeouts |
| Input validation | Manual type checking | Zod schemas via `server.tool()` | MCP SDK validates automatically |
| Error responses | Custom error objects | `warudoError()` helper | Consistent MCP error format |

**Key insight:** Phase 2 should reuse everything from Phase 1. The only new code is the tool handler logic -- the infrastructure is already in place.

## Common Pitfalls

### Pitfall 1: WebSocket Protocol Uncertainty

**What goes wrong:** Sending WebSocket actions with incorrect names or formats. Warudo either ignores the message or returns unexpected responses.
**Why it happens:** The external WebSocket protocol is not fully documented. Action names inferred from the C# SDK may not map 1:1 to external WebSocket actions.
**How to avoid:** Implement defensively -- check response structure before accessing properties. Log raw responses to stderr for debugging. Include helpful error messages that mention what was attempted. Consider a "discovery" approach where the first implementation tries known actions and falls back gracefully.
**Warning signs:** Tools returning empty results or timing out when Warudo is running and connected.

### Pitfall 2: Large Response Data

**What goes wrong:** Returning the entire scene state as a single text blob. AI context windows get filled with property data, degrading response quality.
**Why it happens:** Easy to just JSON.stringify the WebSocket response.
**How to avoid:** Summarize asset lists (name, type, ID only). Provide detail only when asked for a specific asset via get_asset_details. Paginate or truncate if an asset has hundreds of properties.
**Warning signs:** AI responses start ignoring or misinterpreting tool results.

### Pitfall 3: Not Handling Missing/Null Fields

**What goes wrong:** Accessing `response.assets` or `response.data` that may not exist in the Warudo response, causing TypeErrors.
**Why it happens:** Assuming a specific response structure without validation.
**How to avoid:** Always check response fields exist before accessing. Use optional chaining (`?.`). Type the response as `unknown` and validate before casting.
**Warning signs:** "Cannot read property of undefined" errors in tool handlers.

### Pitfall 4: Tool Naming Inconsistency

**What goes wrong:** Tools named differently across phases (camelCase vs snake_case, verb_noun vs noun_verb).
**Why it happens:** No naming convention established.
**How to avoid:** Use consistent `snake_case` with `verb_noun` pattern: `list_assets`, `get_asset_details`, `get_server_info`. Phase 3 should continue: `set_asset_property`, `invoke_trigger`. Keep names under 30 chars and descriptive for AI tool selection.
**Warning signs:** AI assistants struggle to pick the right tool.

## Code Examples

### REST-based Server Info Tool

```typescript
// Source: existing WarudoRestClient pattern from Phase 1
server.tool(
  "get_server_info",
  "Get Warudo version, loaded plugins, and available scenes",
  {},
  async () => {
    try {
      const [about, scenes] = await Promise.all([
        restClient.getAbout(),
        restClient.getScenes(),
      ]);

      const aboutObj = about as Record<string, unknown>;
      const sceneList = Array.isArray(scenes) ? scenes : [];

      const text = [
        `Warudo Version: ${aboutObj.version ?? "unknown"}`,
        `Plugins: ${JSON.stringify(aboutObj.plugins ?? [])}`,
        `Available Scenes: ${sceneList.length > 0 ? sceneList.join(", ") : "none"}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (err) {
      return warudoError(
        `Failed to get server info: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
);
```

### WebSocket-based Asset Listing Tool

```typescript
// Source: existing WarudoWebSocketClient.send() pattern
server.tool(
  "list_assets",
  "List all assets in the current Warudo scene with names, types, and entity IDs",
  {},
  async () => {
    try {
      await wsClient.ensureConnected();
      const response = await wsClient.send({ action: "getScene" });

      // Defensive: validate response structure
      const assets = Array.isArray(response?.assets) ? response.assets : [];

      if (assets.length === 0) {
        return { content: [{ type: "text", text: "No assets found in the current scene." }] };
      }

      const lines = assets.map((a: any) =>
        `- ${a.name ?? "unnamed"} (type: ${a.type ?? "unknown"}) [ID: ${a.id ?? "no-id"}]`
      );

      return {
        content: [{ type: "text", text: `Scene Assets (${assets.length}):\n${lines.join("\n")}` }],
      };
    } catch (err) {
      return warudoError(
        `Failed to list assets: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
);
```

### WebSocket-based Asset Detail Tool

```typescript
server.tool(
  "get_asset_details",
  "Get detailed data input port values for a specific asset by entity ID",
  {
    entityId: z.string().describe("The entity ID (UUID) of the asset to inspect"),
  },
  async ({ entityId }) => {
    try {
      await wsClient.ensureConnected();
      // Try to get the full scene and filter for the specific asset
      const response = await wsClient.send({ action: "getScene" });

      const assets = Array.isArray(response?.assets) ? response.assets : [];
      const asset = assets.find((a: any) => a.id === entityId);

      if (!asset) {
        return warudoError(
          `Asset not found with ID: ${entityId}\n\nUse list_assets to see available assets and their IDs.`
        );
      }

      // Format asset details for AI consumption
      const details = [
        `Name: ${asset.name ?? "unnamed"}`,
        `Type: ${asset.type ?? "unknown"}`,
        `ID: ${asset.id}`,
        `Active: ${asset.active ?? "unknown"}`,
        "",
        "Data Input Ports:",
        ...Object.entries(asset.dataInputs ?? {}).map(
          ([key, val]) => `  ${key}: ${JSON.stringify(val)}`
        ),
      ].join("\n");

      return { content: [{ type: "text", text: details }] };
    } catch (err) {
      return warudoError(
        `Failed to get asset details: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Each tool in separate file with registry | Inline tools in index.ts | Phase 1 pattern | Keep inline for Phase 2 (only 3-4 new tools); refactor to separate files when tool count exceeds ~8 |
| Raw JSON responses | Formatted text responses | Best practice from MCP ecosystem | AI assistants process structured text better than raw JSON |

## Open Questions

1. **Exact WebSocket action names for scene queries**
   - What we know: `setEntityDataInputPortValue` exists (from user's SDK reference), implying a `getEntityDataInputPortValue` or `getScene` equivalent exists
   - What's unclear: The exact action name, message format, and response structure for read operations
   - Recommendation: Implement with best-guess action names (`getScene`, `getEntityDataInputPortValue`). Include comprehensive error handling for unexpected responses. Test against a running Warudo instance early. If actions don't work, fall back to alternative approaches (e.g., `sendPluginMessage` to a custom read plugin).

2. **Scene data response structure**
   - What we know: Warudo scenes are JSON files containing asset lists and blueprint lists (per Scene API docs). Assets have entity IDs (UUID), types, names, and data input ports.
   - What's unclear: How the scene JSON is structured when returned via WebSocket (might differ from the file format).
   - Recommendation: Parse response defensively with `unknown` types, validate structure, and log raw responses to stderr for debugging during development.

3. **Asset type enumeration**
   - What we know: Warudo has CharacterAsset, CameraAsset, PropAsset, DirectorAsset, ScreenAsset, LightAsset, EnvironmentAsset, AnchorAsset, and custom plugin asset types.
   - What's unclear: Whether asset types are returned as full class names, short names, or GUIDs.
   - Recommendation: Return whatever Warudo provides. Don't try to normalize or map types until we see actual response data.

4. **Whether list_assets should support type filtering**
   - CONTEXT.md marks this as Claude's discretion
   - Recommendation: Start without filtering (return all assets). Add optional `type` parameter if the asset list is commonly too large. Simpler tools are better for AI assistants -- they can filter in their reasoning.

## Sources

### Primary (HIGH confidence)
- Phase 1 codebase -- existing `WarudoWebSocketClient`, `WarudoRestClient`, `warudoError()`, `server.tool()` patterns
- Phase 1 research (`01-RESEARCH.md`) -- MCP SDK patterns, Zod schema usage, error handling patterns
- [Warudo Handbook - Scene API](https://docs.warudo.app/docs/scripting/api/scene) -- `Context.OpenedScene.GetAssets()`, scene data model

### Secondary (MEDIUM confidence)
- [Warudo Handbook - Entities](https://docs.warudo.app/docs/scripting/api/entities) -- entity UUID identification, four entity types
- [Warudo Handbook - Ports & Triggers](https://docs.warudo.app/docs/scripting/api/ports-and-triggers) -- `GetDataInput<T>(key)` API for reading port values
- [Warudo Handbook - Assets](https://docs.warudo.app/docs/scripting/api/assets) -- asset type system, active state, GameObjectAsset
- Project FEATURES.md research -- scene inspection prioritization, comparable MCP server approaches

### Tertiary (LOW confidence)
- WebSocket action names (`getScene`, `getEntityDataInputPortValue`) -- inferred from user's SDK reference and C# API naming conventions, not independently verified
- Response structure assumptions -- based on C# Scene API; actual WebSocket response may differ

## Metadata

**Confidence breakdown:**
- REST tools (get_server_info, list_scenes): HIGH -- endpoints already tested in Phase 1
- WebSocket scene query (list_assets): MEDIUM -- action name and response format unverified
- WebSocket asset detail (get_asset_details): MEDIUM -- depends on scene query working correctly
- Tool naming and structure: HIGH -- follows established MCP patterns

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain, 30-day validity)
