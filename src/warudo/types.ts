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
