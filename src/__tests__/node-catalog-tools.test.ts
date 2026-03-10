import { describe, it, expect } from "vitest";
import {
  extractNodeTypesFromScene,
  formatNodeTypeList,
} from "../tools/node-catalog-tools.js";

describe("extractNodeTypesFromScene", () => {
  it("returns empty array for empty response", () => {
    expect(extractNodeTypesFromScene({})).toEqual([]);
  });

  it("returns empty array for response with no graphs", () => {
    expect(extractNodeTypesFromScene({ assets: [{ Id: "1" }] })).toEqual([]);
  });

  it("extracts types from PascalCase graph nodes", () => {
    const resp = {
      graphs: [
        {
          Nodes: [
            {
              TypeId: "OnKeyPressNode",
              Name: "Key Trigger",
              DataInputs: { Key: "Space" },
            },
          ],
        },
      ],
    };
    const types = extractNodeTypesFromScene(resp);
    expect(types).toHaveLength(1);
    expect(types[0].typeId).toBe("OnKeyPressNode");
    expect(types[0].usageCount).toBe(1);
    expect(types[0].exampleNames).toEqual(["Key Trigger"]);
    expect(types[0].dataInputKeys).toEqual(["Key"]);
  });

  it("extracts types from camelCase graph nodes", () => {
    const resp = {
      graphs: [
        {
          nodes: [
            {
              typeId: "OnKeyPressNode",
              name: "Key Trigger",
              dataInputs: { Key: "Space" },
            },
          ],
        },
      ],
    };
    const types = extractNodeTypesFromScene(resp);
    expect(types).toHaveLength(1);
    expect(types[0].typeId).toBe("OnKeyPressNode");
  });

  it("deduplicates types across multiple graphs", () => {
    const resp = {
      graphs: [
        {
          Nodes: [{ TypeId: "OnKeyPressNode", Name: "Trigger 1" }],
        },
        {
          Nodes: [{ TypeId: "OnKeyPressNode", Name: "Trigger 2" }],
        },
      ],
    };
    const types = extractNodeTypesFromScene(resp);
    expect(types).toHaveLength(1);
    expect(types[0].usageCount).toBe(2);
  });

  it("counts usage correctly across graphs", () => {
    const resp = {
      graphs: [
        {
          Nodes: [
            { TypeId: "OnKeyPressNode" },
            { TypeId: "PlayAnimationNode" },
            { TypeId: "OnKeyPressNode" },
          ],
        },
      ],
    };
    const types = extractNodeTypesFromScene(resp);
    expect(types).toHaveLength(2);
    // Sorted by usageCount desc
    expect(types[0].typeId).toBe("OnKeyPressNode");
    expect(types[0].usageCount).toBe(2);
    expect(types[1].typeId).toBe("PlayAnimationNode");
    expect(types[1].usageCount).toBe(1);
  });

  it("collects unique example names", () => {
    const resp = {
      graphs: [
        {
          Nodes: [
            { TypeId: "OnKeyPressNode", Name: "Space Key" },
            { TypeId: "OnKeyPressNode", Name: "Enter Key" },
            { TypeId: "OnKeyPressNode", Name: "Space Key" }, // duplicate
          ],
        },
      ],
    };
    const types = extractNodeTypesFromScene(resp);
    expect(types[0].exampleNames).toHaveLength(2);
    expect(types[0].exampleNames).toContain("Space Key");
    expect(types[0].exampleNames).toContain("Enter Key");
  });

  it("collects data input keys", () => {
    const resp = {
      graphs: [
        {
          Nodes: [
            {
              TypeId: "PlayAnimationNode",
              DataInputs: { Animation: "wave", Speed: 1.0 },
            },
            {
              TypeId: "PlayAnimationNode",
              DataInputs: { Animation: "idle", Layer: 0 },
            },
          ],
        },
      ],
    };
    const types = extractNodeTypesFromScene(resp);
    expect(types[0].dataInputKeys).toContain("Animation");
    expect(types[0].dataInputKeys).toContain("Speed");
    expect(types[0].dataInputKeys).toContain("Layer");
  });

  it("skips nodes with unknown typeId", () => {
    const resp = {
      graphs: [
        {
          Nodes: [{ Name: "No Type" }], // no TypeId
        },
      ],
    };
    const types = extractNodeTypesFromScene(resp);
    expect(types).toHaveLength(0);
  });

  it("handles empty Nodes array", () => {
    const resp = {
      graphs: [{ Nodes: [] }],
    };
    const types = extractNodeTypesFromScene(resp);
    expect(types).toHaveLength(0);
  });

  it("handles multiple types across multiple graphs", () => {
    const resp = {
      graphs: [
        {
          Nodes: [
            { TypeId: "OnKeyPressNode", DataInputs: { Key: "Space" } },
            { TypeId: "PlayAnimationNode", DataInputs: { Animation: "wave" } },
          ],
        },
        {
          Nodes: [
            { TypeId: "WaitNode", DataInputs: { Duration: 1.0 } },
            { TypeId: "PlayAnimationNode", DataInputs: { Animation: "idle" } },
          ],
        },
      ],
    };
    const types = extractNodeTypesFromScene(resp);
    expect(types).toHaveLength(3);
    // PlayAnimationNode should be first (2 usages)
    expect(types[0].typeId).toBe("PlayAnimationNode");
    expect(types[0].usageCount).toBe(2);
  });
});

describe("formatNodeTypeList", () => {
  it("returns empty message for no types", () => {
    const result = formatNodeTypeList([]);
    expect(result).toContain("No node types found");
    expect(result).toContain("warudo://node-catalog");
  });

  it("formats single type with count and names", () => {
    const result = formatNodeTypeList([
      {
        typeId: "OnKeyPressNode",
        usageCount: 3,
        exampleNames: ["Key Trigger"],
        dataInputKeys: ["Key"],
      },
    ]);
    expect(result).toContain("Node Types (1 types found");
    expect(result).toContain("OnKeyPressNode (used 3x)");
    expect(result).toContain("Names: Key Trigger");
    expect(result).toContain("Data Inputs: Key");
  });

  it("formats type with no names as unnamed", () => {
    const result = formatNodeTypeList([
      {
        typeId: "WaitNode",
        usageCount: 1,
        exampleNames: [],
        dataInputKeys: [],
      },
    ]);
    expect(result).toContain("Names: unnamed");
    expect(result).toContain("Data Inputs: none observed");
  });

  it("formats multiple types", () => {
    const result = formatNodeTypeList([
      {
        typeId: "OnKeyPressNode",
        usageCount: 5,
        exampleNames: ["Trigger"],
        dataInputKeys: ["Key"],
      },
      {
        typeId: "PlayAnimationNode",
        usageCount: 2,
        exampleNames: ["Wave", "Idle"],
        dataInputKeys: ["Animation", "Speed"],
      },
    ]);
    expect(result).toContain("Node Types (2 types found");
    expect(result).toContain("OnKeyPressNode");
    expect(result).toContain("PlayAnimationNode");
    expect(result).toContain("Wave, Idle");
    expect(result).toContain("Animation, Speed");
  });

  it("includes tip about node catalog resource", () => {
    const result = formatNodeTypeList([
      {
        typeId: "OnKeyPressNode",
        usageCount: 1,
        exampleNames: [],
        dataInputKeys: [],
      },
    ]);
    expect(result).toContain("warudo://node-catalog");
  });
});
