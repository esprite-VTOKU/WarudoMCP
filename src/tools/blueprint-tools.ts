import { randomUUID } from "crypto";
import type { WarudoWebSocketClient } from "../warudo/websocket-client.js";
import type {
  WarudoGraphSummary,
  WarudoGraphJson,
  WarudoNodeJson,
  WarudoConnectionJson,
} from "../warudo/types.js";
import { warudoError, errorMessage, checkResponseError } from "../errors.js";

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
  wsClient: WarudoWebSocketClient
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
      `Failed to list blueprints: ${errorMessage(err)}\n\nMake sure Warudo is running and connected via WebSocket on ${wsClient.getUrl()}`
    );
  }
}

// --- Blueprint Creation ---

/** Input types for create_blueprint tool parameters. */
export interface CreateBlueprintInput {
  name: string;
  enabled?: boolean;
  nodes: Array<{
    typeId: string;
    name?: string;
    dataInputs?: Record<string, unknown>;
    position?: { x: number; y: number };
  }>;
  dataConnections?: Array<{
    sourceNodeIndex: number;
    sourcePort: string;
    destNodeIndex: number;
    destPort: string;
  }>;
  flowConnections?: Array<{
    sourceNodeIndex: number;
    sourcePort: string;
    destNodeIndex: number;
    destPort: string;
  }>;
}

/** Build a Warudo graph JSON from structured input. */
export function buildGraphJson(input: CreateBlueprintInput): WarudoGraphJson {
  const graphId = randomUUID();

  // Generate node IDs and build node objects
  const nodeIds: string[] = [];
  const nodes: WarudoNodeJson[] = input.nodes.map((n, i) => {
    const nodeId = randomUUID();
    nodeIds.push(nodeId);
    return {
      Id: nodeId,
      TypeId: n.typeId,
      Name: n.name,
      GraphPosition: n.position
        ? { X: n.position.x, Y: n.position.y }
        : { X: (i % 4) * 300, Y: Math.floor(i / 4) * 300 },
      DataInputs: n.dataInputs ?? {},
    };
  });

  // Build connections using node indices -> node IDs
  const resolveConnection = (conn: {
    sourceNodeIndex: number;
    sourcePort: string;
    destNodeIndex: number;
    destPort: string;
  }): WarudoConnectionJson | null => {
    if (conn.sourceNodeIndex < 0 || conn.sourceNodeIndex >= nodeIds.length)
      return null;
    if (conn.destNodeIndex < 0 || conn.destNodeIndex >= nodeIds.length)
      return null;
    return {
      SourceNodeId: nodeIds[conn.sourceNodeIndex],
      SourcePort: conn.sourcePort,
      DestNodeId: nodeIds[conn.destNodeIndex],
      DestPort: conn.destPort,
    };
  };

  const dataConnections = (input.dataConnections ?? [])
    .map(resolveConnection)
    .filter((c): c is WarudoConnectionJson => c !== null);

  const flowConnections = (input.flowConnections ?? [])
    .map(resolveConnection)
    .filter((c): c is WarudoConnectionJson => c !== null);

  return {
    Id: graphId,
    Name: input.name,
    Enabled: input.enabled !== false,
    Nodes: nodes,
    DataConnections: dataConnections,
    FlowConnections: flowConnections,
  };
}

/** Format the create_blueprint success response. */
export function formatCreateBlueprintResponse(
  graphJson: WarudoGraphJson
): string {
  const lines = [
    "Blueprint created successfully.",
    `Name: ${graphJson.Name}`,
    `ID: ${graphJson.Id}`,
    `Nodes: ${graphJson.Nodes.length}`,
    `Data Connections: ${graphJson.DataConnections.length}`,
    `Flow Connections: ${graphJson.FlowConnections.length}`,
    `Enabled: ${graphJson.Enabled}`,
  ];
  return lines.join("\n");
}

/** create_blueprint tool handler. */
export async function createBlueprintHandler(
  wsClient: WarudoWebSocketClient,
  params: CreateBlueprintInput
) {
  try {
    // Validate at least one node exists
    if (!params.nodes || params.nodes.length === 0) {
      return warudoError(
        "Blueprint must have at least one node.\n\nProvide a nodes array with at least one entry, each with a typeId field."
      );
    }

    // Validate node typeIds are non-empty
    for (let i = 0; i < params.nodes.length; i++) {
      if (!params.nodes[i].typeId || params.nodes[i].typeId.trim() === "") {
        return warudoError(
          `Node at index ${i} has an empty typeId.\n\nEvery node must have a typeId (e.g., a GUID like "e931f780-e41e-40ce-96d0-a4d47ca64853" or a type name).`
        );
      }
    }

    // Validate connection indices
    const nodeCount = params.nodes.length;
    const allConnections = [
      ...(params.dataConnections ?? []),
      ...(params.flowConnections ?? []),
    ];
    for (const conn of allConnections) {
      if (conn.sourceNodeIndex < 0 || conn.sourceNodeIndex >= nodeCount) {
        return warudoError(
          `Connection references sourceNodeIndex ${conn.sourceNodeIndex} but only ${nodeCount} nodes exist (indices 0-${nodeCount - 1}).`
        );
      }
      if (conn.destNodeIndex < 0 || conn.destNodeIndex >= nodeCount) {
        return warudoError(
          `Connection references destNodeIndex ${conn.destNodeIndex} but only ${nodeCount} nodes exist (indices 0-${nodeCount - 1}).`
        );
      }
    }

    // Build graph JSON
    const graphJson = buildGraphJson(params);

    // Send to Warudo via importGraph
    await wsClient.ensureConnected();
    const response = await wsClient.send({
      action: "importGraph",
      graph: JSON.stringify(graphJson),
    });

    const respError = checkResponseError(response as Record<string, unknown>);
    if (respError) {
      return warudoError(
        `Warudo rejected the blueprint: ${respError}\n\nThe graph JSON format may not match what Warudo expects. This is a known limitation — Warudo's ImportGraph format is not fully documented.\n\nAlternative: Use send_plugin_message to send the graph to a companion Warudo plugin that uses the C# Graph API.`
      );
    }

    const text = formatCreateBlueprintResponse(graphJson);
    return { content: [{ type: "text" as const, text }] };
  } catch (err) {
    return warudoError(
      `Failed to create blueprint: ${errorMessage(err)}\n\nMake sure Warudo is running and connected via WebSocket on ${wsClient.getUrl()}\n\nIf importGraph is not a recognized action, try using send_plugin_message with a companion plugin instead.`
    );
  }
}

// --- Blueprint Lifecycle Management ---

/** Format manage_blueprint response. */
export function formatManageBlueprintResponse(
  action: "enable" | "disable" | "remove",
  blueprintId: string
): string {
  const actionPast =
    action === "enable"
      ? "enabled"
      : action === "disable"
        ? "disabled"
        : "removed";
  return `Blueprint ${actionPast} successfully.\nBlueprint ID: ${blueprintId}`;
}

/** manage_blueprint tool handler. */
export async function manageBlueprintHandler(
  wsClient: WarudoWebSocketClient,
  params: {
    action: "enable" | "disable" | "remove";
    blueprintId: string;
  }
) {
  try {
    await wsClient.ensureConnected();

    if (params.action === "enable" || params.action === "disable") {
      const enabled = params.action === "enable";
      const response = await wsClient.send({
        action: "setEntityDataInputPortValue",
        entityId: params.blueprintId,
        portKey: "Enabled",
        value: enabled,
      });

      const respError = checkResponseError(response as Record<string, unknown>);
      if (respError) {
        return warudoError(
          `Failed to ${params.action} blueprint: ${respError}\n\nMake sure:\n- Blueprint ID is valid (use list_blueprints to find IDs)\n- The graph entity supports the "Enabled" data input port\n\nIf setEntityDataInputPortValue doesn't work on graphs, try using send_plugin_message with a companion plugin.`
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: formatManageBlueprintResponse(
              params.action,
              params.blueprintId
            ),
          },
        ],
      };
    }

    if (params.action === "remove") {
      const response = await wsClient.send({
        action: "removeGraph",
        graphId: params.blueprintId,
      });

      const respError = checkResponseError(response as Record<string, unknown>);
      if (respError) {
        return warudoError(
          `Failed to remove blueprint: ${respError}\n\nMake sure:\n- Blueprint ID is valid (use list_blueprints to find IDs)\n\nIf removeGraph is not a recognized action, try using send_plugin_message with a companion plugin that calls Context.OpenedScene.RemoveGraph().`
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: formatManageBlueprintResponse(
              params.action,
              params.blueprintId
            ),
          },
        ],
      };
    }

    return warudoError(
      `Unknown action: ${params.action}\n\nValid actions: enable, disable, remove`
    );
  } catch (err) {
    return warudoError(
      `Failed to ${params.action} blueprint: ${errorMessage(err)}\n\nMake sure Warudo is running and connected via WebSocket on ${wsClient.getUrl()}\n\nUse list_blueprints to verify the blueprint ID exists.`
    );
  }
}
