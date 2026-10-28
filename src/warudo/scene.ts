// Plain-data views of Warudo 0.15 payloads: GET /api/openedScene,
// getAssetTypeList and getNodeTypeList.

export interface PortProperties {
  label?: string | null;
  hidden?: boolean;
  disabled?: boolean;
  description?: string | null;
}

export interface DataInputPort {
  type?: string;
  typeKind?: string;
  value?: string;
  defaultValue?: string;
  properties?: PortProperties;
}

export interface TriggerPort {
  key?: string;
  properties?: PortProperties;
}

export interface Entity {
  id: string;
  typeId: string;
  name: string;
  active?: boolean;
  dataInputs?: Record<string, DataInputPort>;
  triggers?: Record<string, TriggerPort>;
}

export interface GraphNode extends Entity {
  x?: number;
  y?: number;
  dataOutputs?: Record<string, { type?: string }>;
  flowInputs?: Record<string, unknown>;
  flowOutputs?: Record<string, unknown>;
}

export interface Connection {
  outputNode: string;
  inputNode: string;
  outputPort: string;
  inputPort: string;
}

export interface Graph {
  id: string;
  name: string;
  enabled: boolean;
  group?: string | null;
  nodes: Record<string, GraphNode>;
  dataConnections: Connection[];
  flowConnections: Connection[];
}

export interface Scene {
  name: string;
  appVersion?: string;
  assets: Entity[];
  graphs: Graph[];
}

export interface TypeInfo {
  id: string;
  title: string;
  category: string;
  searchHint?: string;
}

interface TypeCategories {
  categories?: { name: string; assetTypes?: TypeInfo[]; nodeTypes?: TypeInfo[] }[];
}

export const flattenTypes = (list: unknown): TypeInfo[] =>
  ((list as TypeCategories)?.categories ?? []).flatMap((c) => [...(c.assetTypes ?? []), ...(c.nodeTypes ?? [])]);

export const typeTitles = (types: TypeInfo[]): Map<string, string> => new Map(types.map((t) => [t.id, t.title]));

/** The class name Warudo puts in a search hint, e.g. "SetAnimatorControllerFloatNode". */
const className = (t: TypeInfo): string | undefined =>
  t.searchHint?.split(";").find((part) => /^[A-Z][A-Za-z0-9]*(Node|Asset)$/.test(part));

/** Resolve a node or asset type by id, title, or class name (case-insensitive). */
export function resolveType(query: string, types: TypeInfo[]): TypeInfo | undefined {
  const q = query.trim().toLowerCase();
  return (
    types.find((t) => t.id.toLowerCase() === q) ??
    types.find((t) => t.title.toLowerCase() === q) ??
    types.find((t) => className(t)?.toLowerCase() === q) ??
    types.find((t) => className(t)?.toLowerCase() === `${q}node`)
  );
}

export const searchTypes = (types: TypeInfo[], search?: string, category?: string): TypeInfo[] => {
  const s = search?.toLowerCase();
  const c = category?.toLowerCase();
  return types.filter(
    (t) =>
      (!c || t.category.toLowerCase().includes(c)) &&
      (!s || t.title.toLowerCase().includes(s) || (t.searchHint ?? "").toLowerCase().includes(s) || t.id === search)
  );
};

export interface FoundEntity {
  entity: Entity;
  graph?: Graph;
}

/** Find an asset, or a node in any graph, by id. */
export function findEntity(scene: Scene, id: string): FoundEntity | undefined {
  const asset = scene.assets.find((a) => a.id === id);
  if (asset) return { entity: asset };
  for (const graph of scene.graphs) {
    const node = graph.nodes[id];
    if (node) return { entity: node, graph };
  }
  return undefined;
}

/** Port values arrive JSON-encoded as strings. */
export function decodePortValue(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Drop inline SVG icons that enum values carry; they are noise for a reader. */
const stripIcons = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripIcons);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => k !== "icon")
        .map(([k, v]) => [k, stripIcons(v)])
    );
  }
  return value;
};

export function formatValue(value: unknown, maxLength = 300): string {
  const text = typeof value === "string" ? JSON.stringify(value) : JSON.stringify(stripIcons(value)) ?? "null";
  return text.length > maxLength ? `${text.slice(0, maxLength)}… (${text.length} chars)` : text;
}

export function describePorts(entity: Entity, opts: { port?: string; includeHidden?: boolean; maxLength?: number }): string[] {
  const ports = Object.entries(entity.dataInputs ?? {}).filter(
    ([key, p]) => (opts.port ? key === opts.port : opts.includeHidden || !p.properties?.hidden)
  );
  return ports.map(([key, p]) => {
    const label = p.properties?.label && p.properties.label !== key ? ` "${p.properties.label}"` : "";
    const flags = [p.properties?.hidden && "hidden", p.properties?.disabled && "disabled"].filter(Boolean);
    const type = p.typeKind === "Enum" ? `enum ${p.type}` : p.type;
    return `  ${key}${label} (${type}${flags.length ? `, ${flags.join(", ")}` : ""}) = ${formatValue(decodePortValue(p.value), opts.maxLength)}`;
  });
}

export const triggerKeys = (entity: Entity): string[] =>
  Object.entries(entity.triggers ?? {})
    .filter(([, t]) => !t.properties?.hidden)
    .map(([key, t]) => (t.properties?.label ? `${key} "${t.properties.label}"` : key));
