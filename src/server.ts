import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "./config.js";
import { errorMessage, warudoError } from "./errors.js";
import { WarudoRestClient, type HttpMethod } from "./warudo/rest-client.js";
import { WarudoWebSocketClient } from "./warudo/websocket-client.js";
import {
  decodePortValue,
  describePorts,
  findEntity,
  flattenTypes,
  formatValue,
  resolveType,
  searchTypes,
  triggerKeys,
  typeTitles,
  type Graph,
  type Scene,
  type TypeInfo,
} from "./warudo/scene.js";

export interface Clients {
  config: Config;
  ws: WarudoWebSocketClient;
  rest: WarudoRestClient;
  /** Type lists change only when plugins load, so keep them for the process. */
  types: { asset?: TypeInfo[]; node?: TypeInfo[] };
}

export const createClients = (config: Config): Clients => ({
  config,
  ws: new WarudoWebSocketClient(config.warudoWsUrl),
  rest: new WarudoRestClient(config.warudoRestUrl),
  types: {},
});

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

/** Run a tool body and turn a thrown error into an MCP tool error. */
const guarded =
  <A>(what: string, body: (args: A) => Promise<string>) =>
  async (args: A) => {
    try {
      return text(await body(args));
    } catch (err) {
      return warudoError(`${what} failed: ${errorMessage(err)}`);
    }
  };

const nodeCount = (g: Graph) => Object.keys(g.nodes ?? {}).length;

export function buildServer({ config, ws, rest, types: cache }: Clients): McpServer {
  const server = new McpServer({ name: "warudo-mcp", version: "0.2.0" });

  const scene = async () => (await rest.get("/openedScene")) as Scene;
  const getAssetTypes = async () => (cache.asset ??= flattenTypes(await ws.request("getAssetTypeList")));
  const getNodeTypes = async () => (cache.node ??= flattenTypes(await ws.request("getNodeTypeList", null, { timeoutMs: 20000 })));

  server.tool(
    "ping",
    "Check that this server can open the Warudo editor WebSocket.",
    {},
    guarded("ping", async () => {
      await ws.ensureConnected();
      return `pong: Warudo WebSocket ${ws.getState()} at ${config.warudoWsUrl}`;
    })
  );

  server.tool(
    "check_connection",
    "Check that Warudo's REST API (19052) and editor WebSocket (19053) accept this server, and report the Warudo version.",
    {},
    guarded("check_connection", async () => {
      const [restResult, wsResult] = await Promise.allSettled([rest.get("/about"), ws.ensureConnected()]);
      const about = restResult.status === "fulfilled" ? (restResult.value as { version?: string; licensed?: boolean }) : undefined;
      return [
        restResult.status === "fulfilled"
          ? `REST: ok (${config.warudoRestUrl}), Warudo ${about?.version ?? "?"}${about?.licensed ? "" : ", unlicensed"}`
          : `REST: error - ${errorMessage(restResult.reason)}`,
        wsResult.status === "fulfilled" ? `WebSocket: ok (${config.warudoWsUrl})` : `WebSocket: error - ${errorMessage(wsResult.reason)}`,
      ].join("\n");
    })
  );

  server.tool(
    "get_server_info",
    "Warudo version, loaded plugins, saved scenes, and the opened scene name.",
    {},
    guarded("get_server_info", async () => {
      const [about, scenes, opened] = await Promise.all([rest.get("/about"), rest.get("/scenes"), scene()]);
      const a = about as { version?: string; plugins?: { id: string; name: string; version: string }[] };
      const sceneList = (scenes as { name: string }[]) ?? [];
      return [
        `Warudo ${a.version ?? "?"}`,
        `Opened scene: ${opened.name}`,
        `Plugins (${a.plugins?.length ?? 0}):`,
        ...(a.plugins ?? []).map((p) => `  - ${p.name} [${p.id}] ${p.version}`),
        `Saved scenes (${sceneList.length}):`,
        ...sceneList.map((s) => `  - ${s.name}`),
      ].join("\n");
    })
  );

  server.tool(
    "list_scenes",
    "List saved Warudo scenes.",
    {},
    guarded("list_scenes", async () => {
      const scenes = ((await rest.get("/scenes")) as { name: string }[]) ?? [];
      return scenes.length ? [`Scenes (${scenes.length}):`, ...scenes.map((s) => `  - ${s.name}`)].join("\n") : "No scenes.";
    })
  );

  server.tool(
    "list_assets",
    "List assets in the opened scene with type, entity ID, and active state.",
    { type_filter: z.string().optional().describe("Case-insensitive substring of the asset type title, e.g. 'Character' or 'VMC'.") },
    guarded("list_assets", async ({ type_filter }) => {
      const [s, titles] = await Promise.all([scene(), getAssetTypes().then(typeTitles)]);
      const rows = s.assets
        .map((a) => ({ a, type: titles.get(a.typeId) ?? a.typeId }))
        .filter(({ type }) => !type_filter || type.toLowerCase().includes(type_filter.toLowerCase()));
      if (rows.length === 0) return type_filter ? `No assets with a type matching '${type_filter}'.` : "No assets.";
      return [
        `Assets in "${s.name}" (${rows.length}):`,
        ...rows.map(({ a, type }) => `  - ${a.name} (${type}) [${a.id}]${a.active === false ? " inactive" : ""}`),
      ].join("\n");
    })
  );

  server.tool(
    "get_asset_details",
    "Read the data input ports and triggers of an asset, or of a blueprint node, by entity ID. Hidden ports are left out unless include_hidden is set.",
    {
      entityId: z.string().describe("Asset or node ID from list_assets or get_blueprint."),
      port_key: z.string().optional().describe("Show only this port, untruncated."),
      include_hidden: z.boolean().optional(),
    },
    guarded("get_asset_details", async ({ entityId, port_key, include_hidden }) => {
      const s = await scene();
      const found = findEntity(s, entityId);
      if (!found) return Promise.reject(new Error(`No asset or node with ID ${entityId}. Use list_assets or get_blueprint.`));
      const { entity, graph } = found;
      const types = graph ? await getNodeTypes() : await getAssetTypes();
      const ports = describePorts(entity, { port: port_key, includeHidden: include_hidden, maxLength: port_key ? 20000 : 300 });
      if (port_key && ports.length === 0) {
        return Promise.reject(new Error(`No port '${port_key}'. Ports: ${Object.keys(entity.dataInputs ?? {}).join(", ")}`));
      }
      const triggers = triggerKeys(entity);
      return [
        `${entity.name} (${typeTitles(types).get(entity.typeId) ?? entity.typeId}) [${entity.id}]${graph ? ` in blueprint "${graph.name}"` : ""}`,
        `Data inputs (${ports.length}):`,
        ...ports,
        ...(port_key ? [] : [`Triggers (${triggers.length}): ${triggers.join(", ") || "none"}`]),
      ].join("\n");
    })
  );

  server.tool(
    "set_data_input",
    "Set a data input port on an asset or node. The value is the decoded JSON value that get_asset_details shows.",
    {
      entityId: z.string(),
      portKey: z.string(),
      value: z.unknown().describe("New port value: number, string, boolean, or object such as {x,y,z}."),
    },
    guarded("set_data_input", async ({ entityId, portKey, value }) => {
      // Same call as the editor: value JSON-encoded, broadcast so open editors update.
      const ok = await ws.request("setEntityDataInputPortValue", { id: entityId, port: portKey, value: JSON.stringify(value), broadcast: true });
      if (ok === false) return Promise.reject(new Error("Warudo returned false; check the port key and value type."));
      return `Set ${portKey} = ${formatValue(value)} on ${entityId}`;
    })
  );

  server.tool(
    "invoke_trigger",
    "Invoke a trigger on an asset or node, such as a button in the asset inspector.",
    { entityId: z.string(), portKey: z.string().describe("Trigger key from get_asset_details.") },
    guarded("invoke_trigger", async ({ entityId, portKey }) => {
      await ws.request("invokeEntityTriggerPort", { id: entityId, port: portKey });
      return `Invoked ${portKey} on ${entityId}`;
    })
  );

  server.tool(
    "send_plugin_message",
    "Send a message to a loaded Warudo plugin.",
    { pluginId: z.string(), action: z.string(), payload: z.unknown().optional() },
    guarded("send_plugin_message", async ({ pluginId, action, payload }) => {
      await ws.request("sendPluginMessage", { pluginId, action, payload: payload ?? null });
      return `Sent ${action} to ${pluginId}`;
    })
  );

  server.tool(
    "list_blueprints",
    "List blueprint graphs in the opened scene.",
    {},
    guarded("list_blueprints", async () => {
      const s = await scene();
      if (s.graphs.length === 0) return "No blueprints.";
      return [
        `Blueprints (${s.graphs.length}):`,
        ...s.graphs.map((g) => `  - ${g.name} [${g.id}] ${g.enabled ? "enabled" : "disabled"}, ${nodeCount(g)} nodes`),
      ].join("\n");
    })
  );

  server.tool(
    "get_blueprint",
    "Show a blueprint's nodes (type, ID, position) and its flow and data connections.",
    { blueprintId: z.string() },
    guarded("get_blueprint", async ({ blueprintId }) => {
      const [s, titles] = await Promise.all([scene(), getNodeTypes().then(typeTitles)]);
      const g = s.graphs.find((x) => x.id === blueprintId);
      if (!g) return Promise.reject(new Error(`No blueprint ${blueprintId}. Use list_blueprints.`));
      const nodes = Object.values(g.nodes);
      const name = (id: string) => g.nodes[id]?.name ?? id;
      return [
        `${g.name} [${g.id}] ${g.enabled ? "enabled" : "disabled"}`,
        `Nodes (${nodes.length}):`,
        ...nodes.map((n) => {
          const type = titles.get(n.typeId) ?? n.typeId;
          return `  - ${n.name}${type === n.name ? "" : ` (${type})`} [${n.id}] at ${n.x},${n.y}`;
        }),
        `Flow (${g.flowConnections.length}):`,
        ...g.flowConnections.map((c) => `  ${name(c.outputNode)}.${c.outputPort} -> ${name(c.inputNode)}.${c.inputPort}`),
        `Data (${g.dataConnections.length}):`,
        ...g.dataConnections.map((c) => `  ${name(c.outputNode)}.${c.outputPort} -> ${name(c.inputNode)}.${c.inputPort}`),
      ].join("\n");
    })
  );

  server.tool(
    "create_blueprint",
    "Create a blueprint from nodes and connections, as the editor does. Node typeId is a type ID, title, or class name from list_types. Connections refer to nodes by array index. Port keys come from get_asset_details on a node, or from an existing blueprint.",
    {
      name: z.string(),
      enabled: z.boolean().optional().describe("Default true."),
      nodes: z.array(
        z.object({
          typeId: z.string(),
          x: z.number().optional(),
          y: z.number().optional(),
          dataInputs: z.record(z.unknown()).optional().describe("Port key -> decoded value."),
        })
      ),
      flowConnections: z
        .array(z.object({ from: z.number(), fromPort: z.string(), to: z.number(), toPort: z.string() }))
        .optional()
        .describe("e.g. {from:0, fromPort:'Exit', to:1, toPort:'Enter'}"),
      dataConnections: z.array(z.object({ from: z.number(), fromPort: z.string(), to: z.number(), toPort: z.string() })).optional(),
    },
    guarded("create_blueprint", async ({ name, enabled, nodes, flowConnections, dataConnections }) => {
      const types = await getNodeTypes();
      const resolved = nodes.map((n) => ({ n, type: resolveType(n.typeId, types) }));
      const missing = resolved.filter((r) => !r.type).map((r) => r.n.typeId);
      if (missing.length) return Promise.reject(new Error(`Unknown node types: ${missing.join(", ")}. Use list_types.`));

      const graph = (await ws.request("addGraph")) as { id: string };
      await ws.request("setGraphName", { graph: graph.id, name });
      const ids: string[] = [];
      for (const [i, { n, type }] of resolved.entries()) {
        const node = (await ws.request("addNodeOfType", { graph: graph.id, type: type!.id, x: n.x ?? i * 300, y: n.y ?? 0 })) as { id: string };
        ids.push(node.id);
        for (const [port, value] of Object.entries(n.dataInputs ?? {})) {
          await ws.request("setEntityDataInputPortValue", { id: node.id, port, value: JSON.stringify(value), broadcast: true });
        }
      }
      const connect = async (action: string, c: { from: number; fromPort: string; to: number; toPort: string }) => {
        const ok = await ws.request(action, { graph: graph.id, outputNode: ids[c.from], inputNode: ids[c.to], outputPort: c.fromPort, inputPort: c.toPort });
        return ok === false ? [`${action} ${c.from}.${c.fromPort} -> ${c.to}.${c.toPort} was refused`] : [];
      };
      const refused: string[] = [];
      for (const c of flowConnections ?? []) refused.push(...(await connect("addFlowConnection", c)));
      for (const c of dataConnections ?? []) refused.push(...(await connect("addDataConnection", c)));
      if (enabled === false) await ws.request("setGraphEnabled", { graph: graph.id, enabled: false });
      return [`Created blueprint "${name}" [${graph.id}] with ${ids.length} nodes.`, ...refused].join("\n");
    })
  );

  server.tool(
    "manage_blueprint",
    "Enable, disable, rename, or remove a blueprint.",
    {
      action: z.enum(["enable", "disable", "rename", "remove"]),
      blueprintId: z.string(),
      name: z.string().optional().describe("New name, for rename."),
    },
    guarded("manage_blueprint", async ({ action, blueprintId, name }) => {
      if (action === "remove") await ws.request("removeGraph", { graph: blueprintId });
      else if (action === "rename") await ws.request("setGraphName", { graph: blueprintId, name: name ?? "" });
      else await ws.request("setGraphEnabled", { graph: blueprintId, enabled: action === "enable" });
      return `${action} ${blueprintId}: done`;
    })
  );

  server.tool(
    "list_types",
    "Search the node types (for blueprints) or asset types that the loaded Warudo plugins provide.",
    {
      kind: z.enum(["node", "asset"]),
      search: z.string().optional().describe("Substring of the title or class name, e.g. 'VMC' or 'OnKeystroke'."),
      category: z.string().optional(),
      limit: z.number().optional().describe("Default 100."),
    },
    guarded("list_types", async ({ kind, search, category, limit }) => {
      const all = kind === "node" ? await getNodeTypes() : await getAssetTypes();
      const hits = searchTypes(all, search, category);
      const shown = hits.slice(0, limit ?? 100);
      return [
        `${hits.length} of ${all.length} ${kind} types${hits.length > shown.length ? ` (first ${shown.length})` : ""}:`,
        ...shown.map((t) => `  - ${t.title} [${t.id}] ${t.category}${t.searchHint ? ` (${t.searchHint.split(";").find((p) => /(Node|Asset)$/.test(p)) ?? ""})` : ""}`),
      ].join("\n");
    })
  );

  server.tool(
    "warudo_request",
    "Send a raw editor-protocol request over the WebSocket and return the reply data as JSON. For investigation. Examples: getPlugins, getAssetTypeList, getEntityDataInputPortValue {id, port}, addAssetOfType {type}, exportAsset {asset} (waitFor 'exportAsset:<id>'), exportGraph {graph} (waitFor 'exportGraph:<id>').",
    {
      action: z.string(),
      data: z.unknown().optional(),
      waitFor: z.string().optional().describe("Reply action, when it differs from the request action."),
      maxLength: z.number().optional().describe("Truncate the reply text. Default 20000."),
    },
    guarded("warudo_request", async ({ action, data, waitFor, maxLength }) =>
      // Export replies carry JSON as a string; decode so it reads as JSON.
      formatValue(decodePortValue(await ws.request(action, data ?? null, { waitFor, timeoutMs: 20000 })), maxLength ?? 20000)
    )
  );

  server.tool(
    "warudo_rest",
    "Call Warudo's REST API under /api and return the body as JSON. For investigation. GET /about, /scenes, /openedScene. PUT /openedScene {name} opens a scene, PUT /openedScene/save saves it.",
    {
      method: z.enum(["GET", "PUT", "POST", "DELETE"]),
      path: z.string().describe("Path under /api, e.g. '/openedScene'."),
      body: z.unknown().optional(),
      maxLength: z.number().optional().describe("Truncate the reply text. Default 20000."),
    },
    guarded("warudo_rest", async ({ method, path, body, maxLength }) =>
      formatValue(await rest.request(method as HttpMethod, path, body), maxLength ?? 20000)
    )
  );

  return server;
}
