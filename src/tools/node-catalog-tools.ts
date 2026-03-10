import type { WarudoWebSocketClient } from "../warudo/websocket-client.js";
import type { NodeTypeInfo } from "../warudo/types.js";
import { extractGraphsFromScene } from "./blueprint-tools.js";
import { warudoError, errorMessage } from "../errors.js";

/** Extract unique node types from all graphs in a scene response. */
export function extractNodeTypesFromScene(
  response: Record<string, unknown>
): NodeTypeInfo[] {
  const graphs = extractGraphsFromScene(response);
  if (!graphs || graphs.length === 0) return [];

  const typeMap = new Map<
    string,
    { count: number; names: Set<string>; dataInputKeys: Set<string> }
  >();

  for (const g of graphs) {
    const graph = g as Record<string, unknown>;
    const nodes = (
      Array.isArray(graph.Nodes)
        ? graph.Nodes
        : Array.isArray(graph.nodes)
          ? graph.nodes
          : []
    ) as Record<string, unknown>[];

    for (const node of nodes) {
      const typeId = String(node.TypeId ?? node.typeId ?? "unknown");
      if (typeId === "unknown") continue;

      const name = String(node.Name ?? node.name ?? "");
      const dataInputs =
        (node.DataInputs as Record<string, unknown> | undefined) ??
        (node.dataInputs as Record<string, unknown> | undefined) ??
        {};
      const inputKeys = Object.keys(dataInputs);

      const entry = typeMap.get(typeId) ?? {
        count: 0,
        names: new Set<string>(),
        dataInputKeys: new Set<string>(),
      };
      entry.count++;
      if (name) entry.names.add(name);
      for (const key of inputKeys) entry.dataInputKeys.add(key);
      typeMap.set(typeId, entry);
    }
  }

  return Array.from(typeMap.entries())
    .map(([typeId, info]) => ({
      typeId,
      usageCount: info.count,
      exampleNames: Array.from(info.names),
      dataInputKeys: Array.from(info.dataInputKeys),
    }))
    .sort((a, b) => b.usageCount - a.usageCount);
}

/** Format node types list for display. */
export function formatNodeTypeList(types: NodeTypeInfo[]): string {
  if (types.length === 0) {
    return "No node types found in the current scene's blueprints.\n\nThis could mean no blueprints exist yet, or the scene has no graphs.\n\nTo generate a blueprint, read the warudo://node-catalog resource for available node types and patterns.";
  }

  const lines: string[] = [
    `Node Types (${types.length} types found across scene blueprints):`,
  ];

  for (const t of types) {
    lines.push(`  - ${t.typeId} (used ${t.usageCount}x)`);
    lines.push(
      `    Names: ${t.exampleNames.length > 0 ? t.exampleNames.join(", ") : "unnamed"}`
    );
    lines.push(
      `    Data Inputs: ${t.dataInputKeys.length > 0 ? t.dataInputKeys.join(", ") : "none observed"}`
    );
  }

  lines.push("");
  lines.push(
    "Tip: Read the warudo://node-catalog resource for a curated reference of common node types, ports, and connection patterns."
  );

  return lines.join("\n");
}

/** list_node_types tool handler. */
export async function listNodeTypesHandler(
  wsClient: WarudoWebSocketClient
) {
  try {
    await wsClient.ensureConnected();
    const response = await wsClient.send({ action: "getScene" });
    const resp = response as Record<string, unknown>;

    const types = extractNodeTypesFromScene(resp);
    const text = formatNodeTypeList(types);

    return { content: [{ type: "text" as const, text }] };
  } catch (err) {
    return warudoError(
      `Failed to list node types: ${errorMessage(err)}\n\nMake sure Warudo is running and connected via WebSocket on ${wsClient.getUrl()}\n\nAlternatively, read the warudo://node-catalog resource for a curated list of common node types.`
    );
  }
}
