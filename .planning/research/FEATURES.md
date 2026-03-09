# Feature Research

**Domain:** MCP server for 3D VTubing application control (Warudo)
**Researched:** 2026-03-09
**Confidence:** MEDIUM -- Warudo's external WebSocket API is not fully documented publicly; feature scope is inferred from the scripting API docs, blueprint node catalog, asset documentation, and comparable MCP servers (Blender MCP, Unity MCP, Minecraft MCP). Exact WebSocket message formats need validation against a running Warudo instance.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **WebSocket connection management** | Foundation -- nothing works without it. Users expect connect/disconnect/reconnect and connection status reporting. | LOW | Warudo listens on port 19190 by default. Must handle reconnection gracefully since Warudo may restart during streaming sessions. |
| **Read scene state** | Every comparable MCP server (Blender MCP, Unity MCP) lets AI inspect current state before modifying it. Without read, the AI is blind. | MEDIUM | Query current assets, their properties, active camera, character state. This is the "context" in Model Context Protocol. |
| **Avatar/character expression control** | Core VTubing use case. Expressions are the most common thing streamers toggle. Warudo supports VRM BlendShapeClips (Joy, Angry, Sorrow, Fun) plus custom expressions. | MEDIUM | Toggle expressions by name, set blendshape values. Must handle expression layering (layer 0 = built-in, higher = custom). Use `Toggle Character Expression` equivalent. |
| **Avatar animation control** | Second most common VTuber interaction. Play idle animations, one-shot overlay animations, and transient animations. | MEDIUM | `Play Character One Shot Overlay Animation` is the key node. Must support body part masking, animation weight/speed. Idle animation switching is simpler. |
| **Camera control** | Every 3D control MCP has camera manipulation. Warudo supports Free Look, Orbit Character, and Director modes. | MEDIUM | Set position/rotation/FOV, switch between cameras, switch control modes. Camera switching with fade transitions via `Switch Main Camera`. |
| **Prop manipulation** | Props are fundamental scene objects in VTubing (microphones, swords, food items for stream interactions). | MEDIUM | Create, position, rotate, scale, attach to character bones, toggle visibility. Transform attachment to character is critical for held props. |
| **Scene asset listing/discovery** | AI needs to know what's in the scene to manipulate it. Blender MCP and Unity MCP both provide scene graph inspection. | LOW | List all assets by type: characters, cameras, props, lights, anchors, environments, screens. Return IDs, names, active state. |
| **Error handling and feedback** | MCP clients need structured error responses. Without this, AI hallucinates success. | LOW | Return clear error messages for invalid asset IDs, out-of-range values, disconnection states. MCP SDK has built-in error response patterns. |
| **Tool discovery via MCP schema** | MCP protocol requires tools to self-describe with JSON Schema. This is how AI assistants know what's available. | LOW | Every tool must have a descriptive name, description, and input schema. This is handled by the MCP SDK but the quality of descriptions determines AI usability. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Blueprint generation from natural language** | The killer feature. No other VTubing tool has AI-generated automation. Users describe "when someone subscribes, play a dance animation and shake the camera" and the MCP generates the blueprint graph. | HIGH | Requires translating natural language intent into a valid node graph (nodes + flow connections + data connections). Warudo's API supports programmatic blueprint creation via Graph class. JSON export/import is also an option but less flexible. Must validate node types, port compatibility, and connection validity. |
| **Blueprint CRUD operations** | Enable, disable, list, delete, and modify existing blueprints. Lets AI manage the full automation lifecycle. | MEDIUM | Read existing blueprint structure, toggle enabled state, remove blueprints. Modification of existing blueprints is harder than creation -- requires understanding the current graph structure. |
| **Bulk scene operations** | Set up an entire scene in one tool call: "cozy streaming room with soft lighting, camera orbiting the character, character waving". Blender MCP's power comes from `execute_blender_code` for arbitrary operations. | HIGH | Compose multiple asset operations into a single coherent scene setup. May require a "scene template" or "execute sequence" tool rather than individual calls. |
| **Character body IK control** | Make the character look at specific targets, reach toward positions, adjust posture dynamically. Unique to embodied 3D applications. | MEDIUM | Look At IK (head/eye/body weights toward target), Body IK (spine/limb positioning). Useful for reactive VTubing -- character looks at chat, reaches toward donations. |
| **Ragdoll and physics triggers** | Trigger ragdoll, launch character, physics-based comedy moments. Highly valued in VTubing for entertainment. | LOW | Toggle ragdoll on/off, set muscle stiffness. Popular stream interaction trigger. Low complexity because it's mostly toggling existing Warudo features. |
| **Lighting control** | Adjust directional, point, and volumetric lights. Set mood, create dramatic effects. | LOW | Position, color, intensity for light assets. Warudo separates character lighting from environment lighting for fine control. |
| **Post-processing/camera effects** | Bloom, depth of field, color grading, vignetting, night vision, blur, pixelate. Creates cinematic moments. | LOW | These are camera asset properties. Setting values is straightforward. The value is in AI being able to compose multiple effects for mood ("make it look like a horror movie"). |
| **Environment switching** | Change the 3D environment/background. Different scenes for different stream segments. | LOW | Switch environment source, toggle character lighting independence. Simple asset property changes. |
| **Motion capture state management** | Calibrate, pause, resume tracking. Switch between tracking sources. | MEDIUM | Warudo motion capture is implemented via blueprints. Controlling tracking state requires interacting with tracking-related blueprint nodes and asset properties. Complexity depends on how much of this is exposed via the external API. |
| **Resource/prompt support** | MCP resources (read-only data) for scene state, and prompts for common workflows. Beyond just tools. | MEDIUM | Resources: current scene state, asset catalog, available animations/expressions. Prompts: "set up a stream scene", "create a reaction blueprint". These are MCP protocol features beyond basic tools. |
| **Screen/overlay management** | Control Screen assets for showing images, videos, browser sources within the 3D scene. | LOW | Screen assets exist in Warudo. Position, source, visibility control. Useful for in-scene content display. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Arbitrary code execution** | Blender MCP's `execute_blender_code` is its most powerful tool -- run any Python. Tempting to replicate for Warudo. | Warudo's runtime is C#/Unity, not accessible from a TypeScript MCP server. The WebSocket API does not expose arbitrary code execution. Security risk if it did. | Provide comprehensive tool coverage instead. If an operation isn't covered, add a specific tool for it rather than a generic code executor. |
| **Real-time streaming data processing** | Users might want AI to react to face tracking data, stream chat, or audio in real-time through the MCP. | MCP is request-response, not a streaming protocol. Processing real-time data through MCP would have unacceptable latency and overwhelm the AI context window. | Use Warudo blueprints for real-time reactive logic. The MCP should create/configure those blueprints, not replace them. |
| **Direct Unity engine access** | Users want to manipulate Unity GameObjects, shaders, materials at the engine level. | The MCP connects via WebSocket to Warudo's API layer, not to Unity directly. Warudo abstracts Unity behind its asset/node system for good reason (stability, safety). | Work within Warudo's asset abstraction. If something requires Unity-level access, it belongs in a Warudo plugin, not the MCP server. |
| **Persistent state/memory across sessions** | AI remembering previous interactions, scene history, user preferences. | Adds database requirements, privacy concerns, and complexity. The MCP server should be stateless (beyond the active WebSocket connection). | Let the MCP client (Claude Desktop, Cursor) handle conversation memory. The MCP server is a tool bridge, not a persistence layer. |
| **SSE/HTTP transport** | Some users want to connect via HTTP instead of stdio. | Adds deployment complexity. stdio is the standard MCP transport with broadest client support. SSE is being deprecated in favor of Streamable HTTP in the MCP spec but the ecosystem is still settling. | Ship with stdio only for v1 (per PROJECT.md). Revisit transport options if/when a web-based client needs are validated. |
| **GUI/dashboard** | Visual interface for monitoring MCP server state, connection status, tool invocations. | Scope creep. The MCP server is headless by design. Building UI is a separate product. | Log to console/file. If monitoring is needed, a separate tool can read logs. |
| **Multi-instance Warudo control** | Control multiple Warudo instances from one MCP server. | Massively increases complexity. Different ports, state isolation, tool disambiguation. Niche use case. | Support configurable host/port to connect to any single Warudo instance. Multiple MCP server instances can be run for multiple Warudo instances. |

## Feature Dependencies

```
[WebSocket Connection Management]
    |
    +--requires--> [Scene Asset Listing/Discovery]
    |                  |
    |                  +--requires--> [Read Scene State]
    |                  |
    |                  +--enables--> [Avatar Expression Control]
    |                  +--enables--> [Avatar Animation Control]
    |                  +--enables--> [Camera Control]
    |                  +--enables--> [Prop Manipulation]
    |                  +--enables--> [Lighting Control]
    |                  +--enables--> [Environment Switching]
    |                  +--enables--> [Screen/Overlay Management]
    |
    +--enables--> [Blueprint CRUD Operations]
    |                  |
    |                  +--enables--> [Blueprint Generation]
    |
    +--enables--> [Character Body IK Control]
    +--enables--> [Ragdoll/Physics Triggers]
    +--enables--> [Post-Processing/Camera Effects]
    +--enables--> [Bulk Scene Operations]

[Tool Discovery via MCP Schema] -- independent, built at definition time
[Error Handling] -- cross-cutting, required by all tools
[Resource/Prompt Support] -- enhances all tools, requires scene state reading
```

### Dependency Notes

- **All features require WebSocket Connection Management:** Nothing works without a live connection to Warudo. This is the absolute foundation.
- **Scene Asset Listing requires WebSocket:** Must query Warudo for what exists in the current scene before any manipulation.
- **Read Scene State requires Asset Listing:** You need to know what assets exist before you can read their detailed properties.
- **Blueprint Generation requires Blueprint CRUD:** Need to create, list, and validate blueprints before generating complex ones. Understanding existing blueprints prevents conflicts.
- **Bulk Scene Operations require individual asset tools:** Bulk operations compose individual tools. Build the primitives first.
- **Resource/Prompt Support enhances everything:** MCP resources give AI better context for all tool usage, but require scene state reading to populate.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept works.

- [ ] **WebSocket connection management** -- connect, disconnect, reconnect, status. Without this, nothing works.
- [ ] **Scene asset listing/discovery** -- list all assets in scene by type. AI needs to know what exists.
- [ ] **Read scene state** -- get properties of any asset. AI needs context before acting.
- [ ] **Avatar expression control** -- toggle expressions, set blendshapes. Most requested VTuber interaction.
- [ ] **Avatar animation control** -- play one-shot overlay animations, switch idle animation. Second most requested.
- [ ] **Camera control** -- switch cameras, set position/rotation/FOV. Fundamental to any 3D control tool.
- [ ] **Prop manipulation** -- create, position, attach to character, toggle visibility. Core scene interaction.
- [ ] **Error handling and structured responses** -- clear MCP error responses for all failure modes.
- [ ] **Tool discovery via MCP schema** -- well-described tools with JSON Schema inputs.

### Add After Validation (v1.x)

Features to add once core control is working and validated against a real Warudo instance.

- [ ] **Blueprint CRUD operations** -- list, enable/disable, delete blueprints. Add when users want to manage automation.
- [ ] **Lighting control** -- adjust lights in scene. Add when users need mood/atmosphere control.
- [ ] **Post-processing/camera effects** -- bloom, DOF, color grading. Add when cinematic control is requested.
- [ ] **Environment switching** -- change backgrounds. Add when scene variety is needed.
- [ ] **Character body IK control** -- look at targets, reach positions. Add when reactive character behavior is requested.
- [ ] **Ragdoll/physics triggers** -- comedy physics moments. Add when entertainment interactions are requested.
- [ ] **Screen/overlay management** -- control in-scene screens. Add when in-scene content display is needed.
- [ ] **Resource/prompt support** -- MCP resources and prompts for better AI context.

### Future Consideration (v2+)

Features to defer until core product is validated and users are actively using it.

- [ ] **Blueprint generation from natural language** -- the killer differentiator, but HIGH complexity. Needs deep understanding of Warudo's node type catalog, port compatibility, and connection validation. Defer until basic control is rock-solid and the node type system is fully mapped.
- [ ] **Bulk scene operations** -- composing multiple tools into scene-level operations. Needs individual tools to be stable first.
- [ ] **Motion capture state management** -- tracking calibration and control. Needs investigation into what's externally accessible.
- [ ] **Warudo plugin bridge** -- architecture that lets a future C# plugin reuse tool definitions (per PROJECT.md). Design for this from day 1 but implement the plugin later.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| WebSocket connection management | HIGH | LOW | P1 |
| Scene asset listing/discovery | HIGH | LOW | P1 |
| Read scene state | HIGH | MEDIUM | P1 |
| Avatar expression control | HIGH | MEDIUM | P1 |
| Avatar animation control | HIGH | MEDIUM | P1 |
| Camera control | HIGH | MEDIUM | P1 |
| Prop manipulation | HIGH | MEDIUM | P1 |
| Error handling | HIGH | LOW | P1 |
| Tool discovery (MCP schema) | HIGH | LOW | P1 |
| Blueprint CRUD operations | MEDIUM | MEDIUM | P2 |
| Lighting control | MEDIUM | LOW | P2 |
| Post-processing/camera effects | MEDIUM | LOW | P2 |
| Environment switching | MEDIUM | LOW | P2 |
| Character body IK control | MEDIUM | MEDIUM | P2 |
| Ragdoll/physics triggers | MEDIUM | LOW | P2 |
| Screen/overlay management | LOW | LOW | P2 |
| Resource/prompt support | MEDIUM | MEDIUM | P2 |
| Blueprint generation | HIGH | HIGH | P3 |
| Bulk scene operations | MEDIUM | HIGH | P3 |
| Motion capture management | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- validates the concept
- P2: Should have, add iteratively once core works
- P3: Nice to have, requires core stability and deeper research

## Competitor Feature Analysis

| Feature | Blender MCP | Unity MCP | Minecraft MCP | Our Approach (WarudoMCP) |
|---------|-------------|-----------|---------------|--------------------------|
| Scene inspection | List objects, materials, textures | Search GameObjects by criteria | World state query | List all Warudo assets by type with full property read |
| Object manipulation | Create, modify, delete 3D objects | Create, rename, delete GameObjects, adjust transforms | Place blocks, build structures | Create, position, rotate, scale, attach props and assets |
| Code/script execution | `execute_blender_code` (arbitrary Python) | Generate C# scripts, apply edits | Not applicable | No arbitrary execution -- comprehensive named tools instead |
| Automation/scripting | Not directly (Python code covers it) | Not directly | Not applicable | Blueprint generation -- visual scripting from natural language |
| Camera control | Set camera position/properties | Scene camera manipulation | Player perspective | Full camera control including Director system, transitions, effects |
| Character/avatar control | Not applicable (no characters) | Not applicable (game-specific) | Player movement, inventory | Full VRM avatar control: expressions, animations, IK, ragdoll |
| Real-time state sync | Viewport rendering, AI can "see" renders | Live scene updates | Real-time world interaction | Scene state queries (no viewport streaming -- that's an anti-feature) |
| Tool count | 17-51 tools (varies by implementation) | 33+ tools in graphics alone | ~20 tools | Target 20-30 tools for v1, organized by asset type |

## Warudo-Specific Feature Considerations

### WebSocket API Uncertainty (MEDIUM confidence)

Warudo's WebSocket API for external control is not fully documented publicly. The documentation focuses on the C# scripting API (for plugins running inside Warudo) rather than the external WebSocket protocol. Key uncertainties:

1. **Message format:** The exact JSON message format for external WebSocket commands is not documented in the handbook. It needs to be reverse-engineered from the Stream Deck plugin source or discovered via community resources (Discord).
2. **Available operations:** It's unclear which operations are available via external WebSocket versus only through the internal C# API. Some features may require a Warudo plugin to expose.
3. **Port 19190:** Referenced as the default WebSocket port, shared conceptually with OSC (different protocol/transport). Needs validation.

**Mitigation:** Phase 1 of development must include API exploration -- connect to a running Warudo instance and map available WebSocket endpoints before committing to a feature set.

### Blueprint Generation Complexity

Blueprint generation is the most ambitious feature and the primary differentiator. Key challenges:

1. **Node type catalog:** Must know all available node types, their ports, and compatible connections. This catalog is not available as a static list -- it depends on installed plugins.
2. **Validation:** Generated blueprints must be valid. Invalid connections or missing required data inputs will cause errors or silent failures.
3. **Scope management:** Start with simple blueprints (event -> action) before attempting complex multi-node graphs with conditionals and data flow.

### VTubing-Specific Features

Unlike generic 3D tools (Blender, Unity), VTubing has specific interaction patterns:

1. **Stream integration triggers:** React to Twitch redeems, donations, chat commands. Blueprints handle this, and the MCP should be able to create those blueprints.
2. **Motion capture awareness:** The MCP should understand that animations layer on top of (not replace) motion capture. One-shot overlays blend with tracking.
3. **Expression layering:** VRM expressions have layers (0 = built-in, higher = custom). The MCP must respect this system.
4. **Performance sensitivity:** VTubers run Warudo during live streams. MCP operations must not cause frame drops or visual glitches.

## Sources

- [Warudo Handbook - Scripting API Overview](https://docs.warudo.app/docs/scripting/api/overview) -- API architecture, entity types, WebSocket communication model
- [Warudo Handbook - Blueprint Overview](https://docs.warudo.app/docs/blueprints/overview) -- Blueprint capabilities, example use cases
- [Warudo Handbook - Generating Blueprints](https://docs.warudo.app/docs/scripting/api/generating-blueprints) -- Programmatic blueprint creation via Graph API and JSON import
- [Warudo Handbook - Character Asset](https://docs.warudo.app/docs/assets/character) -- Expression system, animation types, IK, ragdoll, tracking
- [Warudo Handbook - Camera Asset](https://docs.warudo.app/docs/assets/camera) -- Camera modes, post-processing, output options
- [Warudo Handbook - Prop Asset](https://docs.warudo.app/docs/assets/prop) -- Prop setup, transform attachment
- [Warudo Handbook - Director Asset](https://docs.warudo.app/docs/assets/director) -- Cinemachine-based cinematic camera control (Pro only)
- [Warudo Handbook - Entities](https://docs.warudo.app/docs/scripting/api/entities) -- Four entity types (Node, Asset, Plugin, StructuredData)
- [Warudo Handbook - Assets API](https://docs.warudo.app/docs/scripting/api/assets) -- Asset creation, lifecycle, GameObject management
- [Warudo Steam Discussion - Blueprint REST API](https://steamcommunity.com/app/2079120/discussions/0/3812908540893823781/) -- Confirms HTTP/Webhook not yet available; WebSocket is the path
- [Blender MCP GitHub](https://github.com/ahujasid/blender-mcp) -- Comparable MCP server for 3D application (17-51 tools)
- [Unity MCP GitHub](https://github.com/CoderGamester/mcp-unity) -- Comparable MCP server for Unity Editor
- [Poly MCP Blender Server](https://github.com/poly-mcp/Blender-MCP-Server) -- 51-tool Blender MCP with thread-safe execution

---
*Feature research for: MCP server for Warudo (3D VTubing software)*
*Researched: 2026-03-09*
