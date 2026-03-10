import { describe, it, expect } from "vitest";
import {
  NODE_CATALOG_TEXT,
  getNodeCatalogResource,
} from "../resources/node-catalog.js";

describe("NODE_CATALOG_TEXT", () => {
  it("is a non-empty string", () => {
    expect(typeof NODE_CATALOG_TEXT).toBe("string");
    expect(NODE_CATALOG_TEXT.length).toBeGreaterThan(100);
  });

  it("contains Event Nodes section", () => {
    expect(NODE_CATALOG_TEXT).toContain("Event Nodes");
    expect(NODE_CATALOG_TEXT).toContain("OnKeyPressNode");
  });

  it("contains Action Nodes section", () => {
    expect(NODE_CATALOG_TEXT).toContain("Action Nodes");
    expect(NODE_CATALOG_TEXT).toContain("PlayAnimationNode");
    expect(NODE_CATALOG_TEXT).toContain("SetExpressionNode");
  });

  it("contains Flow Control Nodes section", () => {
    expect(NODE_CATALOG_TEXT).toContain("Flow Control Nodes");
    expect(NODE_CATALOG_TEXT).toContain("WaitNode");
    expect(NODE_CATALOG_TEXT).toContain("BranchNode");
  });

  it("contains Common Blueprint Patterns section", () => {
    expect(NODE_CATALOG_TEXT).toContain("Common Blueprint Patterns");
    expect(NODE_CATALOG_TEXT).toContain("sourceNodeIndex");
    expect(NODE_CATALOG_TEXT).toContain("flowConnections");
  });

  it("contains tips for blueprint generation", () => {
    expect(NODE_CATALOG_TEXT).toContain("Tips for Blueprint Generation");
    expect(NODE_CATALOG_TEXT).toContain("event node");
  });

  it("documents port names for connections", () => {
    expect(NODE_CATALOG_TEXT).toContain("Flow Inputs:");
    expect(NODE_CATALOG_TEXT).toContain("Flow Outputs:");
    expect(NODE_CATALOG_TEXT).toContain("Data Inputs:");
    expect(NODE_CATALOG_TEXT).toContain("Exit");
    expect(NODE_CATALOG_TEXT).toContain("Enter");
  });
});

describe("getNodeCatalogResource", () => {
  it("returns a function", () => {
    const handler = getNodeCatalogResource();
    expect(typeof handler).toBe("function");
  });

  it("handler returns valid MCP resource content", async () => {
    const handler = getNodeCatalogResource();
    const result = await handler();
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].uri).toBe("warudo://node-catalog");
    expect(result.contents[0].mimeType).toBe("text/markdown");
    expect(result.contents[0].text).toBe(NODE_CATALOG_TEXT);
  });

  it("handler returns consistent content across calls", async () => {
    const handler = getNodeCatalogResource();
    const result1 = await handler();
    const result2 = await handler();
    expect(result1.contents[0].text).toBe(result2.contents[0].text);
  });
});
