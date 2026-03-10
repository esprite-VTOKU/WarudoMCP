import { describe, it, expect } from "vitest";
import {
  extractGraphsFromScene,
  parseGraphSummary,
  formatBlueprintList,
  buildGraphJson,
  formatCreateBlueprintResponse,
  formatManageBlueprintResponse,
} from "../tools/blueprint-tools.js";
import type { WarudoGraphJson } from "../warudo/types.js";

describe("extractGraphsFromScene", () => {
  it("extracts from top-level graphs field", () => {
    const resp = { graphs: [{ Id: "1", Name: "Test" }] };
    expect(extractGraphsFromScene(resp)).toEqual([{ Id: "1", Name: "Test" }]);
  });

  it("extracts from top-level blueprints field", () => {
    const resp = { blueprints: [{ Id: "1" }] };
    expect(extractGraphsFromScene(resp)).toEqual([{ Id: "1" }]);
  });

  it("extracts from top-level Graphs field (PascalCase)", () => {
    const resp = { Graphs: [{ Id: "1" }] };
    expect(extractGraphsFromScene(resp)).toEqual([{ Id: "1" }]);
  });

  it("extracts from nested data.graphs", () => {
    const resp = { data: { graphs: [{ Id: "1" }] } };
    expect(extractGraphsFromScene(resp)).toEqual([{ Id: "1" }]);
  });

  it("returns undefined when no graphs found", () => {
    const resp = { assets: [{ Id: "1" }] };
    expect(extractGraphsFromScene(resp)).toBeUndefined();
  });

  it("returns undefined for empty response", () => {
    expect(extractGraphsFromScene({})).toBeUndefined();
  });
});

describe("parseGraphSummary", () => {
  it("parses a graph with PascalCase fields", () => {
    const raw = {
      Id: "abc-123",
      Name: "My Blueprint",
      Enabled: true,
      Nodes: [{}, {}, {}],
    };
    expect(parseGraphSummary(raw)).toEqual({
      id: "abc-123",
      name: "My Blueprint",
      enabled: true,
      nodeCount: 3,
    });
  });

  it("parses a graph with camelCase fields", () => {
    const raw = {
      id: "def-456",
      name: "Another BP",
      enabled: false,
      nodes: [{}, {}],
    };
    expect(parseGraphSummary(raw)).toEqual({
      id: "def-456",
      name: "Another BP",
      enabled: false,
      nodeCount: 2,
    });
  });

  it("defaults enabled to true when field missing", () => {
    const raw = { Id: "1", Name: "Test", Nodes: [] };
    expect(parseGraphSummary(raw).enabled).toBe(true);
  });

  it("defaults nodeCount to 0 when Nodes missing", () => {
    const raw = { Id: "1", Name: "Test" };
    expect(parseGraphSummary(raw).nodeCount).toBe(0);
  });

  it("uses fallback values for missing id and name", () => {
    const raw = {};
    const result = parseGraphSummary(raw);
    expect(result.id).toBe("no-id");
    expect(result.name).toBe("unnamed");
  });
});

describe("formatBlueprintList", () => {
  it("formats empty list", () => {
    expect(formatBlueprintList([])).toBe(
      "No blueprints found in the current scene."
    );
  });

  it("formats single enabled blueprint", () => {
    const result = formatBlueprintList([
      { id: "abc", name: "My BP", enabled: true, nodeCount: 5 },
    ]);
    expect(result).toContain("Blueprints (1):");
    expect(result).toContain("My BP [ID: abc] (5 nodes)");
    expect(result).not.toContain("[disabled]");
  });

  it("marks disabled blueprints", () => {
    const result = formatBlueprintList([
      { id: "abc", name: "Disabled BP", enabled: false, nodeCount: 2 },
    ]);
    expect(result).toContain("[disabled]");
  });

  it("formats multiple blueprints", () => {
    const result = formatBlueprintList([
      { id: "1", name: "BP1", enabled: true, nodeCount: 3 },
      { id: "2", name: "BP2", enabled: false, nodeCount: 0 },
    ]);
    expect(result).toContain("Blueprints (2):");
    expect(result).toContain("BP1");
    expect(result).toContain("BP2");
  });
});

describe("buildGraphJson", () => {
  it("generates unique IDs for graph and nodes", () => {
    const result = buildGraphJson({
      name: "Test Graph",
      nodes: [{ typeId: "type-a" }, { typeId: "type-b" }],
    });
    expect(result.Id).toBeTruthy();
    expect(result.Nodes[0].Id).toBeTruthy();
    expect(result.Nodes[1].Id).toBeTruthy();
    expect(result.Id).not.toBe(result.Nodes[0].Id);
    expect(result.Nodes[0].Id).not.toBe(result.Nodes[1].Id);
  });

  it("sets name and enabled correctly", () => {
    const result = buildGraphJson({
      name: "My Blueprint",
      enabled: false,
      nodes: [{ typeId: "type-a" }],
    });
    expect(result.Name).toBe("My Blueprint");
    expect(result.Enabled).toBe(false);
  });

  it("defaults enabled to true", () => {
    const result = buildGraphJson({
      name: "Test",
      nodes: [{ typeId: "type-a" }],
    });
    expect(result.Enabled).toBe(true);
  });

  it("auto-positions nodes in grid layout", () => {
    const result = buildGraphJson({
      name: "Test",
      nodes: [
        { typeId: "a" },
        { typeId: "b" },
        { typeId: "c" },
        { typeId: "d" },
        { typeId: "e" },
      ],
    });
    // First row: 0*300, 1*300, 2*300, 3*300
    expect(result.Nodes[0].GraphPosition).toEqual({ X: 0, Y: 0 });
    expect(result.Nodes[1].GraphPosition).toEqual({ X: 300, Y: 0 });
    expect(result.Nodes[3].GraphPosition).toEqual({ X: 900, Y: 0 });
    // Second row starts at index 4
    expect(result.Nodes[4].GraphPosition).toEqual({ X: 0, Y: 300 });
  });

  it("uses provided positions when specified", () => {
    const result = buildGraphJson({
      name: "Test",
      nodes: [{ typeId: "a", position: { x: 100, y: 200 } }],
    });
    expect(result.Nodes[0].GraphPosition).toEqual({ X: 100, Y: 200 });
  });

  it("resolves flow connections using node indices", () => {
    const result = buildGraphJson({
      name: "Test",
      nodes: [{ typeId: "a" }, { typeId: "b" }],
      flowConnections: [
        {
          sourceNodeIndex: 0,
          sourcePort: "Exit",
          destNodeIndex: 1,
          destPort: "Enter",
        },
      ],
    });
    expect(result.FlowConnections).toHaveLength(1);
    expect(result.FlowConnections[0].SourceNodeId).toBe(result.Nodes[0].Id);
    expect(result.FlowConnections[0].DestNodeId).toBe(result.Nodes[1].Id);
    expect(result.FlowConnections[0].SourcePort).toBe("Exit");
    expect(result.FlowConnections[0].DestPort).toBe("Enter");
  });

  it("resolves data connections using node indices", () => {
    const result = buildGraphJson({
      name: "Test",
      nodes: [{ typeId: "a" }, { typeId: "b" }],
      dataConnections: [
        {
          sourceNodeIndex: 0,
          sourcePort: "Output",
          destNodeIndex: 1,
          destPort: "Input",
        },
      ],
    });
    expect(result.DataConnections).toHaveLength(1);
    expect(result.DataConnections[0].SourceNodeId).toBe(result.Nodes[0].Id);
  });

  it("filters out connections with invalid indices", () => {
    const result = buildGraphJson({
      name: "Test",
      nodes: [{ typeId: "a" }],
      flowConnections: [
        {
          sourceNodeIndex: 0,
          sourcePort: "Exit",
          destNodeIndex: 5,
          destPort: "Enter",
        },
      ],
    });
    expect(result.FlowConnections).toHaveLength(0);
  });

  it("sets DataInputs on nodes", () => {
    const result = buildGraphJson({
      name: "Test",
      nodes: [{ typeId: "a", dataInputs: { Speed: 2.0, Name: "test" } }],
    });
    expect(result.Nodes[0].DataInputs).toEqual({ Speed: 2.0, Name: "test" });
  });
});

describe("formatCreateBlueprintResponse", () => {
  it("includes all graph details", () => {
    const graphJson: WarudoGraphJson = {
      Id: "abc-123",
      Name: "My Blueprint",
      Enabled: true,
      Nodes: [{ Id: "n1", TypeId: "t1" }],
      DataConnections: [],
      FlowConnections: [
        {
          SourceNodeId: "n1",
          SourcePort: "Exit",
          DestNodeId: "n1",
          DestPort: "Enter",
        },
      ],
    };
    const result = formatCreateBlueprintResponse(graphJson);
    expect(result).toContain("Blueprint created successfully");
    expect(result).toContain("My Blueprint");
    expect(result).toContain("abc-123");
    expect(result).toContain("Nodes: 1");
    expect(result).toContain("Flow Connections: 1");
    expect(result).toContain("Data Connections: 0");
  });
});

describe("formatManageBlueprintResponse", () => {
  it("formats enable action", () => {
    const result = formatManageBlueprintResponse("enable", "abc-123");
    expect(result).toContain("enabled successfully");
    expect(result).toContain("abc-123");
  });

  it("formats disable action", () => {
    const result = formatManageBlueprintResponse("disable", "abc-123");
    expect(result).toContain("disabled successfully");
  });

  it("formats remove action", () => {
    const result = formatManageBlueprintResponse("remove", "abc-123");
    expect(result).toContain("removed successfully");
  });
});
