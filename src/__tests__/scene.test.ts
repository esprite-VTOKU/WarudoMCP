import { describe, expect, it } from "vitest";
import { parseToken } from "../warudo/auth.js";
import { loadConfig } from "../config.js";
import { decodePortValue, describePorts, findEntity, flattenTypes, formatValue, resolveType, type Scene } from "../warudo/scene.js";

const nodeTypeList = {
  categories: [
    {
      name: "Animation",
      nodeTypes: [
        {
          id: "16a6bb56-fa06-43a8-b6c9-a983186339eb",
          title: "Set Animator Controller Float",
          category: "Animation",
          searchHint: "CATEGORY_ANIMATION;SetAnimatorControllerFloatNode;SET_ANIMATOR_CONTROLLER_FLOAT;Set Animator Controller Float",
        },
      ],
    },
    { name: "Event", nodeTypes: [{ id: "aaaa", title: "On Keystroke Pressed", category: "Event", searchHint: "CATEGORY_EVENT;OnKeystrokePressedNode" }] },
  ],
};

describe("parseToken", () => {
  it("reads the token from the editor command line", () => {
    const cl = '"C:/Program Files (x86)/Steam/.../warudo-client-electron.exe" --token=abc123DEF\n"C:/.../warudo-client-electron.exe" --type=gpu-process';
    expect(parseToken(cl)).toBe("abc123DEF");
  });
  it("accepts a quoted token and returns undefined without one", () => {
    expect(parseToken('x.exe --token="q1w2"')).toBe("q1w2");
    expect(parseToken("x.exe --type=renderer")).toBeUndefined();
  });
});

describe("loadConfig", () => {
  it("takes the HTTP listen address from --http", () => {
    expect(loadConfig(["node", "index.js", "--http=192.168.128.2:8765"]).httpListen).toBe("192.168.128.2:8765");
  });
});

describe("resolveType", () => {
  const types = flattenTypes(nodeTypeList);
  it("matches id, title, class name, and class name without the Node suffix", () => {
    expect(resolveType("16a6bb56-fa06-43a8-b6c9-a983186339eb", types)?.title).toBe("Set Animator Controller Float");
    expect(resolveType("on keystroke pressed", types)?.id).toBe("aaaa");
    expect(resolveType("SetAnimatorControllerFloatNode", types)?.id).toBe("16a6bb56-fa06-43a8-b6c9-a983186339eb");
    expect(resolveType("OnKeystrokePressed", types)?.id).toBe("aaaa");
    expect(resolveType("Nope", types)).toBeUndefined();
  });
});

describe("port values", () => {
  it("decodes JSON-encoded values and drops enum icons when formatting", () => {
    const enumValue = decodePortValue('{"label":"Free Look","value":1,"icon":"<svg/>"}');
    expect(formatValue(enumValue)).toBe('{"label":"Free Look","value":1}');
    expect(decodePortValue("not json")).toBe("not json");
    expect(formatValue("x".repeat(10), 4)).toBe('"xxx… (12 chars)');
  });

  it("lists visible ports with label and type, hidden ones on request", () => {
    const entity = {
      id: "e",
      typeId: "t",
      name: "Camera",
      dataInputs: {
        FieldOfView: { type: "float", value: "35.0", properties: { label: "Field of View" } },
        Secret: { type: "bool", value: "true", properties: { hidden: true } },
      },
    };
    expect(describePorts(entity, {})).toEqual(['  FieldOfView "Field of View" (float) = 35']);
    expect(describePorts(entity, { includeHidden: true })).toHaveLength(2);
    expect(describePorts(entity, { port: "Secret" })).toEqual(["  Secret (bool, hidden) = true"]);
  });
});

describe("findEntity", () => {
  it("finds assets and graph nodes", () => {
    const scene: Scene = {
      name: "S",
      assets: [{ id: "a1", typeId: "t", name: "Character 1" }],
      graphs: [{ id: "g1", name: "G", enabled: true, nodes: { n1: { id: "n1", typeId: "nt", name: "Node" } }, dataConnections: [], flowConnections: [] }],
    };
    expect(findEntity(scene, "a1")?.graph).toBeUndefined();
    expect(findEntity(scene, "n1")?.graph?.id).toBe("g1");
    expect(findEntity(scene, "zz")).toBeUndefined();
  });
});
