import type { WarudoAssetSummary } from "../warudo/types.js";

/** Extract assets array from getScene response with defensive field name fallbacks. */
export function extractAssetsFromScene(
  response: Record<string, unknown>
): unknown[] | undefined {
  if (Array.isArray(response.assets)) return response.assets;
  if (Array.isArray(response.Assets)) return response.Assets;

  if (response.data && typeof response.data === "object") {
    const data = response.data as Record<string, unknown>;
    if (Array.isArray(data.assets)) return data.assets;
    if (Array.isArray(data.Assets)) return data.Assets;
  }

  return undefined;
}

/** Parse a raw asset object into a WarudoAssetSummary. */
export function parseAssetSummary(raw: unknown): WarudoAssetSummary {
  const a = raw as Record<string, unknown>;
  return {
    id: String(a.id ?? a.Id ?? a.guid ?? "no-id"),
    name: String(a.name ?? a.Name ?? "unnamed"),
    type: String(a.type ?? a.Type ?? a.$type ?? "unknown"),
    active: (a.active ?? a.Active ?? a.isActive) as boolean | undefined,
  };
}

/** Format a port value for display, truncating long values. */
export function formatPortValue(value: unknown): string {
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
