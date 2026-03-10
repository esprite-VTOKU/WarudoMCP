import { describe, it, expect } from "vitest";
import {
  extractGraphsFromScene,
  parseGraphSummary,
  formatBlueprintList,
} from "../tools/blueprint-tools.js";

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
