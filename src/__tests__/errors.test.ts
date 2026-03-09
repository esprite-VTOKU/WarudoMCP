import { describe, it, expect } from "vitest";
import { warudoError } from "../errors.js";

describe("warudoError", () => {
  it("returns MCP-compatible isError response", () => {
    const result = warudoError("something went wrong");
    expect(result).toEqual({
      content: [{ type: "text", text: "something went wrong" }],
      isError: true,
    });
  });

  it("preserves the exact message", () => {
    const msg = "Cannot reach Warudo at ws://localhost:19053";
    const result = warudoError(msg);
    expect(result.content[0].text).toBe(msg);
  });
});
