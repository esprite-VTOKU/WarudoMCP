import WebSocket from "ws";
import type { ConnectionState, WarudoWebSocketMessage, WarudoWebSocketResponse } from "./types.js";

export class WarudoWebSocketClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private connectPromise: Promise<void> | null = null;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getUrl(): string {
    return this.url;
  }

  async connect(): Promise<void> {
    if (this.state === "connected") return;
    if (this.state === "connecting" && this.connectPromise) {
      return this.connectPromise;
    }

    this.state = "connecting";
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);

      const timeout = setTimeout(() => {
        ws.close();
        this.state = "disconnected";
        this.connectPromise = null;
        reject(
          new Error(
            `Could not connect to Warudo at ${this.url}. Is Warudo running with WebSocket enabled?`
          )
        );
      }, 5000);

      ws.on("open", () => {
        clearTimeout(timeout);
        this.ws = ws;
        this.state = "connected";
        this.connectPromise = null;
        this.setupEventHandlers(ws);
        resolve();
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        this.state = "disconnected";
        this.connectPromise = null;
        reject(
          new Error(
            `Failed to connect to Warudo at ${this.url}: ${err.message}`
          )
        );
      });
    });

    return this.connectPromise;
  }

  async ensureConnected(): Promise<void> {
    if (this.state !== "connected") {
      await this.connect();
    }
  }

  private setupEventHandlers(ws: WebSocket): void {
    ws.on("close", () => {
      this.state = "disconnected";
      this.ws = null;
      console.error("Warudo WebSocket disconnected");
    });

    ws.on("error", (err) => {
      console.error("Warudo WebSocket error:", err.message);
    });
  }

  async send(message: WarudoWebSocketMessage): Promise<WarudoWebSocketResponse> {
    await this.ensureConnected();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(
        `WebSocket is not open. Could not connect to Warudo at ${this.url}. Is Warudo running with WebSocket enabled?`
      );
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const outbound = { ...message, requestId };

    return new Promise<WarudoWebSocketResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws?.removeListener("message", onMessage);
        reject(
          new Error(
            `Warudo did not respond within 10 seconds for action "${message.action}"`
          )
        );
      }, 10000);

      const onMessage = (data: WebSocket.Data) => {
        try {
          const parsed = JSON.parse(data.toString()) as WarudoWebSocketResponse;
          // Correlate by requestId if present, otherwise accept any response
          if (parsed.requestId !== undefined && parsed.requestId !== requestId) {
            return; // Not our response — ignore
          }
          clearTimeout(timeout);
          this.ws?.removeListener("message", onMessage);
          resolve(parsed);
        } catch {
          // Ignore non-JSON messages
        }
      };

      this.ws!.on("message", onMessage);
      this.ws!.send(JSON.stringify(outbound));
    });
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state = "disconnected";
  }
}
