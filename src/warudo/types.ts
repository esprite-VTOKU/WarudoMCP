export type ConnectionState = "disconnected" | "connecting" | "connected";

export interface WarudoWebSocketMessage {
  action: string;
  [key: string]: unknown;
}

export interface WarudoWebSocketResponse {
  [key: string]: unknown;
}
