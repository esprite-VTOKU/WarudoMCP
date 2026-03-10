#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { WarudoWebSocketClient } from "./warudo/websocket-client.js";
import { WarudoRestClient } from "./warudo/rest-client.js";
import { warudoError } from "./errors.js";
import {
  listBlueprintsHandler,
  createBlueprintHandler,
  manageBlueprintHandler,
} from "./tools/blueprint-tools.js";
import { listNodeTypesHandler } from "./tools/node-catalog-tools.js";
import { getNodeCatalogResource } from "./resources/node-catalog.js";

const server = new McpServer({ name: "warudo-mcp", version: "0.1.0" });

const config = loadConfig();
const wsClient = new WarudoWebSocketClient(config.warudoWsUrl);
const restClient = new WarudoRestClient(config.warudoRestUrl);

// --- MCP Resources ---

server.resource(
  "node-catalog",
  "warudo://node-catalog",
  {
    description:
      "Warudo node type reference catalog with ports, connection rules, and common blueprint patterns. Read this before generating blueprints.",
  },
  getNodeCatalogResource()
);

server.tool("ping", "Check if the MCP server is running and can reach Warudo", {}, async () => {
  try {
    await wsClient.ensureConnected();
    return {
      content: [
        {
          type: "text",
          text: `pong! Warudo WebSocket is ${wsClient.getState()} at ${config.warudoWsUrl}`,
        },
      ],
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error connecting to Warudo";
    return warudoError(
      `Cannot reach Warudo: ${message}\n\nWebSocket state: ${wsClient.getState()}\nMake sure Warudo is running with WebSocket enabled on ${config.warudoWsUrl}`
    );
  }
});

server.tool(
  "check_connection",
  "Check connectivity to both Warudo WebSocket and REST APIs",
  {},
  async () => {
    const results: string[] = [];

    // Check WebSocket
    try {
      await wsClient.ensureConnected();
      results.push(`WebSocket: connected (${config.warudoWsUrl})`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      results.push(`WebSocket: error - ${message}`);
    }

    // Check REST API
    try {
      const about = await restClient.getAbout();
      const version =
        about && typeof about === "object" && "version" in about
          ? (about as Record<string, unknown>).version
          : "unknown";
      results.push(
        `REST API: connected (${config.warudoRestUrl})\nWarudo version: ${version}`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      results.push(`REST API: error - ${message}`);
    }

    const anyError = results.some((r) => r.includes("error -"));
    const text = results.join("\n");

    if (anyError) {
      return warudoError(text);
    }

    return { content: [{ type: "text", text }] };
  }
);

// --- Phase 2: Scene Inspection Tools (read-only) ---

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

      const aboutObj =
        about && typeof about === "object" ? (about as Record<string, unknown>) : {};
      const sceneList = Array.isArray(scenes) ? (scenes as string[]) : [];

      const pluginsRaw = aboutObj.plugins;
      let pluginsText: string;
      if (Array.isArray(pluginsRaw) && pluginsRaw.length > 0) {
        pluginsText = (pluginsRaw as string[]).join(", ");
      } else {
        pluginsText = "none detected";
      }

      const scenesText =
        sceneList.length > 0
          ? sceneList.map((s) => `  - ${s}`).join("\n")
          : "  (none)";

      const text = [
        `Warudo Version: ${aboutObj.version ?? "unknown"}`,
        `Plugins: ${pluginsText}`,
        `Available Scenes (${sceneList.length}):`,
        scenesText,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (err) {
      return warudoError(
        `Failed to get server info: ${err instanceof Error ? err.message : String(err)}\n\nMake sure Warudo is running with the REST API enabled on ${config.warudoRestUrl}`
      );
    }
  }
);

server.tool(
  "list_scenes",
  "List all available Warudo scene files",
  {},
  async () => {
    try {
      const scenes = await restClient.getScenes();
      const sceneList = Array.isArray(scenes) ? (scenes as string[]) : [];

      if (sceneList.length === 0) {
        return {
          content: [{ type: "text", text: "No scenes found." }],
        };
      }

      const text = [
        `Available Scenes (${sceneList.length}):`,
        ...sceneList.map((s) => `  - ${s}`),
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (err) {
      return warudoError(
        `Failed to list scenes: ${err instanceof Error ? err.message : String(err)}\n\nMake sure Warudo is running with the REST API enabled on ${config.warudoRestUrl}`
      );
    }
  }
);

server.tool(
  "list_assets",
  "List all assets in the current Warudo scene with their names, types, and entity IDs",
  {
    type_filter: z
      .string()
      .optional()
      .describe(
        "Filter assets by type (e.g., 'CharacterAsset', 'CameraAsset'). Omit to list all assets."
      ),
  },
  async ({ type_filter }) => {
    try {
      await wsClient.ensureConnected();
      const response = await wsClient.send({ action: "getScene" });

      // Defensive: try multiple response structures
      let rawAssets: unknown[] | undefined;
      const resp = response as Record<string, unknown>;

      if (Array.isArray(resp.assets)) {
        rawAssets = resp.assets;
      } else if (resp.data && typeof resp.data === "object") {
        const data = resp.data as Record<string, unknown>;
        if (Array.isArray(data.assets)) {
          rawAssets = data.assets;
        }
      }

      if (!rawAssets) {
        console.error(
          "list_assets: unexpected response structure, keys:",
          Object.keys(resp)
        );
        return warudoError(
          `Unexpected response from Warudo when listing assets. Response keys: ${Object.keys(resp).join(", ")}\n\nThe WebSocket action "getScene" may not be supported. Try check_connection to verify connectivity.`
        );
      }

      // Map to summaries with defensive access
      let assets = rawAssets.map((a: unknown) => {
        const asset = a as Record<string, unknown>;
        return {
          id: String(asset.id ?? asset.Id ?? asset.guid ?? "no-id"),
          name: String(asset.name ?? asset.Name ?? "unnamed"),
          type: String(asset.type ?? asset.Type ?? asset.$type ?? "unknown"),
          active: asset.active ?? asset.Active ?? asset.isActive,
        };
      });

      // Apply type filter if provided
      if (type_filter) {
        const filter = type_filter.toLowerCase();
        assets = assets.filter((a) => a.type.toLowerCase().includes(filter));

        if (assets.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No assets matching type '${type_filter}' found in the current scene.\n\nUse list_assets without a filter to see all available asset types.`,
              },
            ],
          };
        }
      }

      if (assets.length === 0) {
        return {
          content: [
            { type: "text", text: "No assets found in the current scene." },
          ],
        };
      }

      const lines = assets.map(
        (a) =>
          `  - ${a.name} (type: ${a.type}) [ID: ${a.id}]${a.active === false ? " [inactive]" : ""}`
      );

      const text = [`Scene Assets (${assets.length}):`, ...lines].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (err) {
      return warudoError(
        `Failed to list assets: ${err instanceof Error ? err.message : String(err)}\n\nMake sure Warudo is running and connected via WebSocket on ${config.warudoWsUrl}`
      );
    }
  }
);

server.tool(
  "get_asset_details",
  "Read data input port values for a specific asset by entity ID. Use list_assets first to find entity IDs.",
  {
    entityId: z
      .string()
      .describe(
        "The entity ID (UUID) of the asset to inspect. Get IDs from list_assets."
      ),
    port_key: z
      .string()
      .optional()
      .describe(
        "Specific data input port key to read. Omit to get all ports."
      ),
  },
  async ({ entityId, port_key }) => {
    try {
      await wsClient.ensureConnected();
      const response = await wsClient.send({ action: "getScene" });

      // Extract assets from response (same pattern as list_assets)
      let rawAssets: unknown[] | undefined;
      const resp = response as Record<string, unknown>;

      if (Array.isArray(resp.assets)) {
        rawAssets = resp.assets;
      } else if (resp.data && typeof resp.data === "object") {
        const data = resp.data as Record<string, unknown>;
        if (Array.isArray(data.assets)) {
          rawAssets = data.assets;
        }
      }

      if (!rawAssets) {
        console.error(
          "get_asset_details: unexpected response structure, keys:",
          Object.keys(resp)
        );
        return warudoError(
          `Unexpected response from Warudo when querying assets. Response keys: ${Object.keys(resp).join(", ")}\n\nThe WebSocket action "getScene" may not be supported. Try check_connection to verify connectivity.`
        );
      }

      // Find asset by entity ID
      const asset = rawAssets.find((a: unknown) => {
        const obj = a as Record<string, unknown>;
        return (
          String(obj.id ?? obj.Id ?? obj.guid ?? "") === entityId
        );
      }) as Record<string, unknown> | undefined;

      if (!asset) {
        return warudoError(
          `Asset not found with ID: ${entityId}\n\nUse list_assets to see available assets and their IDs.`
        );
      }

      const name = String(asset.name ?? asset.Name ?? "unnamed");
      const type = String(asset.type ?? asset.Type ?? asset.$type ?? "unknown");
      const active = asset.active ?? asset.Active ?? asset.isActive;

      // Extract data input ports
      const dataInputs: Record<string, unknown> =
        (asset.dataInputs as Record<string, unknown>) ??
        (asset.DataInputs as Record<string, unknown>) ??
        (asset.data as Record<string, unknown>) ??
        {};

      // If port_key specified, return just that port
      if (port_key) {
        if (!(port_key in dataInputs)) {
          const availablePorts = Object.keys(dataInputs);
          const portList =
            availablePorts.length > 20
              ? availablePorts.slice(0, 20).join(", ") +
                ` ... and ${availablePorts.length - 20} more`
              : availablePorts.join(", ");

          return warudoError(
            `Port '${port_key}' not found on asset '${name}' (${type}).\n\nAvailable ports: ${portList || "(none found)"}`
          );
        }

        const value = dataInputs[port_key];
        const formatted = formatPortValue(value);

        const text = [
          `Asset: ${name} (${type}) [ID: ${entityId}]`,
          `Port: ${port_key}`,
          `Value: ${formatted}`,
        ].join("\n");

        return { content: [{ type: "text", text }] };
      }

      // Return all ports
      const portEntries = Object.entries(dataInputs);

      if (portEntries.length === 0) {
        const text = [
          `Asset: ${name} (${type}) [ID: ${entityId}]`,
          `Active: ${active === false ? "no" : "yes"}`,
          "",
          "Data Input Ports: (none found)",
          "",
          "Note: The asset may have properties stored in a different format. Check the raw response structure.",
        ].join("\n");

        return { content: [{ type: "text", text }] };
      }

      const portLines = portEntries.map(
        ([key, val]) => `  ${key}: ${formatPortValue(val)}`
      );

      const text = [
        `Asset: ${name} (${type}) [ID: ${entityId}]`,
        `Active: ${active === false ? "no" : "yes"}`,
        "",
        `Data Input Ports (${portEntries.length}):`,
        ...portLines,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (err) {
      return warudoError(
        `Failed to read asset details: ${err instanceof Error ? err.message : String(err)}\n\nMake sure Warudo is running and connected via WebSocket on ${config.warudoWsUrl}`
      );
    }
  }
);

// --- Phase 3: Asset Control Tools (mutations) ---

server.tool(
  "set_data_input",
  "Set a data input port value on a Warudo asset or node. Use get_asset_details to find available port keys and current values.",
  {
    entityId: z
      .string()
      .describe(
        "Entity ID (UUID) of the asset or node. Get IDs from list_assets."
      ),
    portKey: z
      .string()
      .describe(
        "Data input port key to set. Get available keys from get_asset_details."
      ),
    value: z
      .unknown()
      .describe(
        "New value for the port. Type depends on the port (string, number, boolean, object, etc.)."
      ),
  },
  async ({ entityId, portKey, value }) => {
    try {
      await wsClient.ensureConnected();
      const response = await wsClient.send({
        action: "setEntityDataInputPortValue",
        entityId,
        portKey,
        value,
      });

      // Check for error in response
      const resp = response as Record<string, unknown>;
      if (resp.error || resp.Error) {
        const errMsg = String(resp.error ?? resp.Error);
        return warudoError(
          `Warudo rejected the value change: ${errMsg}\n\nMake sure:\n- Entity ID is valid (use list_assets to find IDs)\n- Port key exists on the entity (use get_asset_details to find ports)\n- Value type matches the port's expected type`
        );
      }

      const text = [
        "Set data input port on entity.",
        `Entity ID: ${entityId}`,
        `Port: ${portKey}`,
        `Value: ${formatPortValue(value)}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (err) {
      return warudoError(
        `Failed to set data input: ${err instanceof Error ? err.message : String(err)}\n\nMake sure:\n- Entity ID is valid (use list_assets to find IDs)\n- Port key exists on the entity (use get_asset_details to find ports)\n- Value type matches the port's expected type`
      );
    }
  }
);

server.tool(
  "invoke_trigger",
  "Invoke a trigger port on a Warudo asset or node (e.g., play animation, take screenshot). Use get_asset_details to find available trigger ports.",
  {
    entityId: z
      .string()
      .describe(
        "Entity ID (UUID) of the asset or node. Get IDs from list_assets."
      ),
    portKey: z
      .string()
      .describe(
        "Trigger port key to invoke. Get available keys from get_asset_details."
      ),
  },
  async ({ entityId, portKey }) => {
    try {
      await wsClient.ensureConnected();
      const response = await wsClient.send({
        action: "invokeEntityTriggerPort",
        entityId,
        portKey,
      });

      // Check for error in response
      const resp = response as Record<string, unknown>;
      if (resp.error || resp.Error) {
        const errMsg = String(resp.error ?? resp.Error);
        return warudoError(
          `Warudo rejected the trigger invocation: ${errMsg}\n\nMake sure:\n- Entity ID is valid (use list_assets to find IDs)\n- Port key is a trigger port on the entity (use get_asset_details to find ports)`
        );
      }

      const text = [
        "Invoked trigger port on entity.",
        `Entity ID: ${entityId}`,
        `Trigger: ${portKey}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (err) {
      return warudoError(
        `Failed to invoke trigger: ${err instanceof Error ? err.message : String(err)}\n\nMake sure:\n- Entity ID is valid (use list_assets to find IDs)\n- Port key is a trigger port on the entity (use get_asset_details to find ports)`
      );
    }
  }
);

server.tool(
  "send_plugin_message",
  "Send a message to a Warudo plugin. The plugin must be loaded and listening for the specified action.",
  {
    pluginId: z
      .string()
      .describe("ID of the target Warudo plugin."),
    action: z
      .string()
      .describe("Action name the plugin is listening for."),
    payload: z
      .unknown()
      .optional()
      .describe("Optional payload data to send with the message."),
  },
  async ({ pluginId, action: pluginAction, payload }) => {
    try {
      await wsClient.ensureConnected();
      // Note: the Warudo SDK expects the plugin action as a field in the message.
      // We use "pluginAction" to avoid collision with the WebSocket "action" field name.
      // If Warudo expects the literal field name "action" for the plugin's action,
      // this may need adjustment when testing against a live Warudo instance.
      const response = await wsClient.send({
        action: "sendPluginMessage",
        pluginId,
        pluginAction,
        payload: payload ?? {},
      });

      // Check for error in response
      const resp = response as Record<string, unknown>;
      if (resp.error || resp.Error) {
        const errMsg = String(resp.error ?? resp.Error);
        return warudoError(
          `Warudo rejected the plugin message: ${errMsg}\n\nMake sure the plugin '${pluginId}' is loaded in Warudo and listening for action '${pluginAction}'.`
        );
      }

      const payloadText =
        payload !== undefined && payload !== null
          ? formatPortValue(payload)
          : "(none)";

      const text = [
        "Sent plugin message.",
        `Plugin ID: ${pluginId}`,
        `Action: ${pluginAction}`,
        `Payload: ${payloadText}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (err) {
      return warudoError(
        `Failed to send plugin message: ${err instanceof Error ? err.message : String(err)}\n\nMake sure the plugin '${pluginId}' is loaded in Warudo and listening for action '${pluginAction}'.`
      );
    }
  }
);

// --- Phase 4: Blueprint CRUD Tools ---

server.tool(
  "list_blueprints",
  "List all blueprint graphs in the current Warudo scene with names, IDs, enabled status, and node counts",
  {},
  async () => listBlueprintsHandler(wsClient, config.warudoWsUrl)
);

server.tool(
  "create_blueprint",
  "Create a new blueprint graph in Warudo with specified nodes and connections. Nodes are referenced by index (0-based) in connection definitions. To generate blueprints from natural language: 1) Read warudo://node-catalog for available node types and connection patterns, 2) Use list_node_types to discover additional node types in the user's scene, 3) Build the nodes array with correct typeId values, 4) Connect nodes with flowConnections (Exit->Enter for execution order) and dataConnections (for passing values). If unsure about node types or ports, ask the user for clarification rather than guessing.",
  {
    name: z.string().describe("Name for the new blueprint graph"),
    enabled: z
      .boolean()
      .optional()
      .describe("Whether to enable the graph immediately (default: true)"),
    nodes: z
      .array(
        z.object({
          typeId: z
            .string()
            .describe(
              "Node type ID (GUID or type name, e.g., 'OnUpdateNode' or a GUID like 'e931f780-...')"
            ),
          name: z.string().optional().describe("Optional display name for the node"),
          dataInputs: z
            .record(z.unknown())
            .optional()
            .describe("Initial data input values as key-value pairs"),
          position: z
            .object({
              x: z.number(),
              y: z.number(),
            })
            .optional()
            .describe("Graph editor position (auto-positioned if omitted)"),
        })
      )
      .describe("Array of nodes to add to the blueprint"),
    dataConnections: z
      .array(
        z.object({
          sourceNodeIndex: z
            .number()
            .describe("Index of source node in nodes array (0-based)"),
          sourcePort: z
            .string()
            .describe("Data output port name on source node"),
          destNodeIndex: z
            .number()
            .describe("Index of destination node in nodes array (0-based)"),
          destPort: z
            .string()
            .describe("Data input port name on destination node"),
        })
      )
      .optional()
      .describe("Data connections between nodes (pass data values)"),
    flowConnections: z
      .array(
        z.object({
          sourceNodeIndex: z
            .number()
            .describe("Index of source node in nodes array (0-based)"),
          sourcePort: z
            .string()
            .describe("Flow output port name on source node (e.g., 'Exit')"),
          destNodeIndex: z
            .number()
            .describe("Index of destination node in nodes array (0-based)"),
          destPort: z
            .string()
            .describe("Flow input port name on destination node (e.g., 'Enter')"),
        })
      )
      .optional()
      .describe("Flow connections between nodes (execution order)"),
  },
  async (params) =>
    createBlueprintHandler(wsClient, config.warudoWsUrl, params)
);

server.tool(
  "manage_blueprint",
  "Enable, disable, or remove an existing blueprint graph. Use list_blueprints to find blueprint IDs.",
  {
    action: z
      .enum(["enable", "disable", "remove"])
      .describe("Action to perform on the blueprint"),
    blueprintId: z
      .string()
      .describe(
        "ID (UUID) of the blueprint graph. Get IDs from list_blueprints."
      ),
  },
  async (params) =>
    manageBlueprintHandler(wsClient, config.warudoWsUrl, params)
);

// --- Phase 5: Blueprint Intelligence Tools ---
// Tool count: 13 (2 Phase 1 + 4 Phase 2 + 3 Phase 3 + 3 Phase 4 + 1 Phase 5) — within 8-15 target

server.tool(
  "list_node_types",
  "List all node types currently used in Warudo scene blueprints. Shows type IDs, usage counts, example names, and observed data input keys. Use this to discover available node types before generating blueprints with create_blueprint. For a curated reference of common node types and connection patterns, read the warudo://node-catalog resource.",
  {},
  async () => listNodeTypesHandler(wsClient, config.warudoWsUrl)
);

/** Format a port value for display, truncating long values. */
function formatPortValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return value.length > 500
      ? value.slice(0, 500) + "... (truncated)"
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const json = JSON.stringify(value, null, 2);
  return json.length > 500
    ? json.slice(0, 500) + "... (truncated)"
    : json;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("warudo-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting warudo-mcp:", err);
  process.exit(1);
});
