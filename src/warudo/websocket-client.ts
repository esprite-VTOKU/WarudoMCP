import WebSocket from "ws";
import { getToken, invalidateToken, tokenHint } from "./auth.js";

// Warudo 0.15 editor protocol: every frame is JSON `{ action, data }`.
// A request's reply uses the same action (some use `action:<id>`), with
// `data` or `error`. Warudo also pushes frames such as `frameUpdate`;
// frames that no request waits for are dropped.

export type ConnectionState = "disconnected" | "connecting" | "connected";

interface Pending {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export interface RequestOptions {
  /** Reply action to wait for; defaults to the request action. */
  waitFor?: string;
  timeoutMs?: number;
}

export class WarudoWebSocketClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private connecting: Promise<void> | null = null;
  private readonly pending = new Map<string, Pending[]>();

  constructor(private readonly url: string) {}

  getState(): ConnectionState {
    return this.state;
  }

  async ensureConnected(): Promise<void> {
    if (this.state === "connected") return;
    this.connecting ??= this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connect(): Promise<void> {
    this.state = "connecting";
    const token = await getToken();
    const ws = new WebSocket(this.url, token ? [token] : []);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error(`Could not connect to Warudo at ${this.url} within 5 seconds.`));
      }, 5000);
      ws.once("open", () => {
        clearTimeout(timer);
        resolve();
      });
      ws.once("unexpected-response", (_req, res) => {
        clearTimeout(timer);
        if (res.statusCode === 401) invalidateToken();
        reject(new Error(res.statusCode === 401 ? tokenHint : `Warudo refused the WebSocket: HTTP ${res.statusCode}`));
      });
      ws.once("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to connect to Warudo at ${this.url}: ${err.message}`));
      });
    }).catch((err) => {
      this.state = "disconnected";
      throw err;
    });

    this.ws = ws;
    this.state = "connected";
    ws.on("message", (raw) => this.onFrame(raw.toString()));
    ws.on("error", (err) => console.error("Warudo WebSocket error:", err.message));
    ws.on("close", () => {
      this.ws = null;
      this.state = "disconnected";
      this.rejectAll(new Error("Warudo WebSocket closed"));
      console.error("Warudo WebSocket disconnected");
    });

    // The editor announces itself before other requests; do the same.
    await this.request("onConnected").catch(() => undefined);
  }

  private onFrame(text: string): void {
    let msg: { action?: string; data?: unknown; error?: unknown };
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!msg.action) return;
    const waiter = this.pending.get(msg.action)?.shift();
    if (!waiter) return;
    clearTimeout(waiter.timer);
    if (msg.error) waiter.reject(new Error(String(msg.error)));
    else waiter.resolve(msg.data ?? null);
  }

  private rejectAll(err: Error): void {
    for (const waiters of this.pending.values()) {
      waiters.forEach((w) => {
        clearTimeout(w.timer);
        w.reject(err);
      });
    }
    this.pending.clear();
  }

  /** Send `{ action, data }` and resolve with the reply's `data`. */
  async request(action: string, data: unknown = null, opts: RequestOptions = {}): Promise<unknown> {
    if (action !== "onConnected") await this.ensureConnected();
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error(`WebSocket to ${this.url} is not open.`);
    const key = opts.waitFor ?? action;
    const timeoutMs = opts.timeoutMs ?? 10000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = this.pending.get(key) ?? [];
        this.pending.set(key, waiters.filter((w) => w.timer !== timer));
        reject(new Error(`Warudo did not reply to "${action}" (waiting for "${key}") within ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(key, [...(this.pending.get(key) ?? []), { resolve, reject, timer }]);
      ws.send(JSON.stringify({ action, data }));
    });
  }

  /** Send without waiting, for actions that have no reply. */
  async notify(action: string, data: unknown = null): Promise<void> {
    await this.ensureConnected();
    this.ws?.send(JSON.stringify({ action, data }));
  }
}
