export type ConnectionState = "disconnected" | "connecting" | "connected";

export interface WarudoWebSocketMessage {
  action: string;
  [key: string]: unknown;
}

export interface WarudoWebSocketResponse {
  [key: string]: unknown;
}

export interface WarudoAssetSummary {
  id: string;
  name: string;
  type: string;
  active?: boolean;
}

export interface WarudoAssetDetail {
  id: string;
  name: string;
  type: string;
  active?: boolean;
  dataInputs: Record<string, unknown>;
}

export interface WarudoGraphSummary {
  id: string;
  name: string;
  enabled: boolean;
  nodeCount: number;
}

export interface WarudoNodeJson {
  Id: string;
  TypeId: string;
  Name?: string;
  GraphPosition?: { X: number; Y: number };
  DataInputs?: Record<string, unknown>;
}

export interface WarudoConnectionJson {
  SourceNodeId: string;
  SourcePort: string;
  DestNodeId: string;
  DestPort: string;
}

export interface WarudoGraphJson {
  Id: string;
  Name: string;
  Enabled: boolean;
  Nodes: WarudoNodeJson[];
  FlowConnections: WarudoConnectionJson[];
  DataConnections: WarudoConnectionJson[];
}

export interface NodeTypeInfo {
  typeId: string;
  usageCount: number;
  exampleNames: string[];
  dataInputKeys: string[];
}
