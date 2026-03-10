import { describe, it, expect, vi } from "vitest";
import { WarudoRestClient } from "../warudo/rest-client.js";

// Helper: format asset list (mirrors logic in index.ts list_assets tool)
function formatAssetList(
  rawAssets: Array<Record<string, unknown>>,
  typeFilter?: string
) {
  let assets = rawAssets.map((a) => ({
    id: String(a.id ?? a.Id ?? a.guid ?? "no-id"),
    name: String(a.name ?? a.Name ?? "unnamed"),
    type: String(a.type ?? a.Type ?? a.$type ?? "unknown"),
    active: a.active ?? a.Active ?? a.isActive,
  }));

  if (typeFilter) {
    const filter = typeFilter.toLowerCase();
    assets = assets.filter((a) => a.type.toLowerCase().includes(filter));
  }

  if (assets.length === 0) {
    return typeFilter
      ? `No assets matching type '${typeFilter}' found in the current scene.`
      : "No assets found in the current scene.";
  }

  const lines = assets.map(
    (a) =>
      `  - ${a.name} (type: ${a.type}) [ID: ${a.id}]${a.active === false ? " [inactive]" : ""}`
  );

  return [`Scene Assets (${assets.length}):`, ...lines].join("\n");
}

describe("REST-based tools", () => {
  it("getAbout returns parseable version info", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          version: "1.2.3",
          plugins: ["PluginA", "PluginB"],
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new WarudoRestClient("http://localhost:19052");
    const about = (await client.getAbout()) as Record<string, unknown>;

    expect(about.version).toBe("1.2.3");
    expect(about.plugins).toEqual(["PluginA", "PluginB"]);
    vi.unstubAllGlobals();
  });

  it("getScenes returns an array of scene names", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(["scene1.warudo", "scene2.warudo"]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new WarudoRestClient("http://localhost:19052");
    const scenes = await client.getScenes();

    expect(Array.isArray(scenes)).toBe(true);
    expect(scenes).toEqual(["scene1.warudo", "scene2.warudo"]);
    vi.unstubAllGlobals();
  });
});

describe("Asset list formatting", () => {
  it("returns 'No assets found' for empty array", () => {
    const result = formatAssetList([]);
    expect(result).toBe("No assets found in the current scene.");
  });

  it("formats assets with name, type, and id", () => {
    const result = formatAssetList([
      { id: "abc-123", name: "MyCharacter", type: "CharacterAsset" },
      { id: "def-456", name: "MainCamera", type: "CameraAsset" },
    ]);

    expect(result).toContain("Scene Assets (2):");
    expect(result).toContain(
      "MyCharacter (type: CharacterAsset) [ID: abc-123]"
    );
    expect(result).toContain(
      "MainCamera (type: CameraAsset) [ID: def-456]"
    );
  });

  it("marks inactive assets", () => {
    const result = formatAssetList([
      { id: "abc-123", name: "MyProp", type: "PropAsset", active: false },
    ]);

    expect(result).toContain("[inactive]");
  });

  it("does not mark active assets as inactive", () => {
    const result = formatAssetList([
      { id: "abc-123", name: "MyProp", type: "PropAsset", active: true },
    ]);

    expect(result).not.toContain("[inactive]");
  });

  it("filters by type (case-insensitive)", () => {
    const result = formatAssetList(
      [
        { id: "abc-123", name: "MyChar", type: "CharacterAsset" },
        { id: "def-456", name: "MainCam", type: "CameraAsset" },
      ],
      "camera"
    );

    expect(result).toContain("Scene Assets (1):");
    expect(result).toContain("MainCam");
    expect(result).not.toContain("MyChar");
  });

  it("returns filter message when no assets match type", () => {
    const result = formatAssetList(
      [{ id: "abc-123", name: "MyChar", type: "CharacterAsset" }],
      "PropAsset"
    );

    expect(result).toContain("No assets matching type 'PropAsset'");
  });

  it("handles missing/null fields gracefully", () => {
    const result = formatAssetList([
      { id: null, name: undefined, type: undefined },
    ]);

    expect(result).toContain("unnamed");
    expect(result).toContain("unknown");
    expect(result).toContain("no-id");
  });

  it("handles alternative field names (Id, Name, $type)", () => {
    const result = formatAssetList([
      { Id: "alt-id", Name: "AltName", $type: "AltType" },
    ]);

    expect(result).toContain("AltName (type: AltType) [ID: alt-id]");
  });
});

// Helper: format port value (mirrors logic in index.ts)
function formatPortValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return value.length > 500
      ? value.slice(0, 500) + "... (truncated)"
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const json = JSON.stringify(value, null, 2);
  return json.length > 500
    ? json.slice(0, 500) + "... (truncated)"
    : json;
}

// Helper: format asset details (mirrors logic in index.ts get_asset_details tool)
function formatAssetDetails(
  asset: Record<string, unknown>,
  portKey?: string
): string {
  const name = String(asset.name ?? asset.Name ?? "unnamed");
  const type = String(asset.type ?? asset.Type ?? asset.$type ?? "unknown");
  const entityId = String(asset.id ?? asset.Id ?? asset.guid ?? "no-id");
  const active = asset.active ?? asset.Active ?? asset.isActive;

  const dataInputs: Record<string, unknown> =
    (asset.dataInputs as Record<string, unknown>) ??
    (asset.DataInputs as Record<string, unknown>) ??
    (asset.data as Record<string, unknown>) ??
    {};

  if (portKey) {
    if (!(portKey in dataInputs)) {
      const availablePorts = Object.keys(dataInputs);
      const portList =
        availablePorts.length > 20
          ? availablePorts.slice(0, 20).join(", ") +
            ` ... and ${availablePorts.length - 20} more`
          : availablePorts.join(", ");
      return `ERROR: Port '${portKey}' not found on asset '${name}' (${type}).\n\nAvailable ports: ${portList || "(none found)"}`;
    }

    const value = dataInputs[portKey];
    return [
      `Asset: ${name} (${type}) [ID: ${entityId}]`,
      `Port: ${portKey}`,
      `Value: ${formatPortValue(value)}`,
    ].join("\n");
  }

  const portEntries = Object.entries(dataInputs);

  if (portEntries.length === 0) {
    return [
      `Asset: ${name} (${type}) [ID: ${entityId}]`,
      `Active: ${active === false ? "no" : "yes"}`,
      "",
      "Data Input Ports: (none found)",
    ].join("\n");
  }

  const portLines = portEntries.map(
    ([key, val]) => `  ${key}: ${formatPortValue(val)}`
  );

  return [
    `Asset: ${name} (${type}) [ID: ${entityId}]`,
    `Active: ${active === false ? "no" : "yes"}`,
    "",
    `Data Input Ports (${portEntries.length}):`,
    ...portLines,
  ].join("\n");
}

describe("Asset detail formatting", () => {
  it("formats asset with multiple data input ports", () => {
    const result = formatAssetDetails({
      id: "abc-123",
      name: "MyChar",
      type: "CharacterAsset",
      active: true,
      dataInputs: {
        Position: { x: 0, y: 1, z: 0 },
        Rotation: { x: 0, y: 90, z: 0 },
        Scale: 1.0,
      },
    });

    expect(result).toContain("Asset: MyChar (CharacterAsset) [ID: abc-123]");
    expect(result).toContain("Active: yes");
    expect(result).toContain("Data Input Ports (3):");
    expect(result).toContain("Position:");
    expect(result).toContain("Rotation:");
    expect(result).toContain("Scale: 1");
  });

  it("formats a single port value when port_key specified", () => {
    const result = formatAssetDetails(
      {
        id: "abc-123",
        name: "MyChar",
        type: "CharacterAsset",
        dataInputs: {
          Position: { x: 1, y: 2, z: 3 },
          Scale: 1.5,
        },
      },
      "Scale"
    );

    expect(result).toContain("Port: Scale");
    expect(result).toContain("Value: 1.5");
    expect(result).not.toContain("Position");
  });

  it("returns error when port_key not found", () => {
    const result = formatAssetDetails(
      {
        id: "abc-123",
        name: "MyChar",
        type: "CharacterAsset",
        dataInputs: { Position: 0, Scale: 1 },
      },
      "NonExistent"
    );

    expect(result).toContain("ERROR: Port 'NonExistent' not found");
    expect(result).toContain("Available ports: Position, Scale");
  });

  it("truncates very long string values (>500 chars)", () => {
    const longString = "x".repeat(600);
    const result = formatPortValue(longString);
    expect(result.length).toBeLessThan(600);
    expect(result).toContain("... (truncated)");
  });

  it("truncates very long JSON values (>500 chars)", () => {
    const bigObject: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      bigObject[`key${i}`] = `value${i}`;
    }
    const result = formatPortValue(bigObject);
    expect(result).toContain("... (truncated)");
  });

  it("handles complex nested values (objects, arrays)", () => {
    const result = formatPortValue({ nested: { deep: [1, 2, 3] } });
    expect(result).toContain('"nested"');
    expect(result).toContain('"deep"');
  });

  it("handles null/undefined port values", () => {
    expect(formatPortValue(null)).toBe("null");
    expect(formatPortValue(undefined)).toBe("null");
  });

  it("handles boolean and number values", () => {
    expect(formatPortValue(true)).toBe("true");
    expect(formatPortValue(42)).toBe("42");
    expect(formatPortValue(3.14)).toBe("3.14");
  });

  it("shows no ports message when dataInputs is empty", () => {
    const result = formatAssetDetails({
      id: "abc-123",
      name: "EmptyAsset",
      type: "SomeType",
      dataInputs: {},
    });

    expect(result).toContain("Data Input Ports: (none found)");
  });

  it("handles alternative dataInputs field names (DataInputs, data)", () => {
    const result = formatAssetDetails({
      id: "abc-123",
      name: "AltAsset",
      type: "SomeType",
      DataInputs: { Foo: "bar" },
    });

    expect(result).toContain("Foo: bar");
  });
});
