import type { WarudoWebSocketClient } from "../warudo/websocket-client.js";
import type { WarudoGraphSummary } from "../warudo/types.js";
import { warudoError } from "../errors.js";

/** Extract graphs array from getScene response with defensive field name fallbacks. */
export function extractGraphsFromScene(
  response: Record<string, unknown>
): unknown[] | undefined {
  // Try top-level
  if (Array.isArray(response.graphs)) return response.graphs;
  if (Array.isArray(response.blueprints)) return response.blueprints;
  if (Array.isArray(response.Graphs)) return response.Graphs;
  if (Array.isArray(response.Blueprints)) return response.Blueprints;

  // Try nested under data
  if (response.data && typeof response.data === "object") {
    const data = response.data as Record<string, unknown>;
    if (Array.isArray(data.graphs)) return data.graphs;
    if (Array.isArray(data.blueprints)) return data.blueprints;
    if (Array.isArray(data.Graphs)) return data.Graphs;
    if (Array.isArray(data.Blueprints)) return data.Blueprints;
  }

  return undefined;
}

/** Parse a raw graph object into a WarudoGraphSummary. */
export function parseGraphSummary(raw: unknown): WarudoGraphSummary {
  const g = raw as Record<string, unknown>;
  const nodes = Array.isArray(g.Nodes)
    ? g.Nodes
    : Array.isArray(g.nodes)
      ? g.nodes
      : [];
  return {
    id: String(g.Id ?? g.id ?? g.guid ?? "no-id"),
    name: String(g.Name ?? g.name ?? "unnamed"),
    enabled: (g.Enabled ?? g.enabled ?? g.Active ?? g.active) !== false,
    nodeCount: nodes.length,
  };
}

/** Format the list_blueprints response text. */
export function formatBlueprintList(graphs: WarudoGraphSummary[]): string {
  if (graphs.length === 0) {
    return "No blueprints found in the current scene.";
  }
  const lines = graphs.map(
    (g) =>
      `  - ${g.name} [ID: ${g.id}] (${g.nodeCount} nodes)${g.enabled ? "" : " [disabled]"}`
  );
  return [`Blueprints (${graphs.length}):`, ...lines].join("\n");
}

/** list_blueprints tool handler. */
export async function listBlueprintsHandler(
  wsClient: WarudoWebSocketClient,
  wsUrl: string
) {
  try {
    await wsClient.ensureConnected();
    const response = await wsClient.send({ action: "getScene" });
    const resp = response as Record<string, unknown>;

    const rawGraphs = extractGraphsFromScene(resp);

    if (!rawGraphs) {
      // Graphs might not be present in the response -- this could mean no blueprints exist
      // or the field name is different. Return empty list rather than error.
      return {
        content: [
          {
            type: "text" as const,
            text:
              "No blueprints found in the current scene.\n\nNote: If you expect blueprints to exist, the scene response may use a different field name. Response keys: " +
              Object.keys(resp).join(", "),
          },
        ],
      };
    }

    const graphs = rawGraphs.map(parseGraphSummary);
    const text = formatBlueprintList(graphs);

    return { content: [{ type: "text" as const, text }] };
  } catch (err) {
    return warudoError(
      `Failed to list blueprints: ${err instanceof Error ? err.message : String(err)}\n\nMake sure Warudo is running and connected via WebSocket on ${wsUrl}`
    );
  }
}
