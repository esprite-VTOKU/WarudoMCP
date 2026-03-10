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
