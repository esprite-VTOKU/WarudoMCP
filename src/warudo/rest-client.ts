import http from "node:http";
import { getToken, invalidateToken, tokenHint } from "./auth.js";

// Uses node:http, not fetch: Warudo's EmbedIO server closes the socket after the
// body, and undici's fetch can hit an internal assertion on large responses.

export type HttpMethod = "GET" | "PUT" | "POST" | "DELETE";

interface RawResponse {
  status: number;
  body: string;
}

const send = (url: URL, method: HttpMethod, token: string | undefined, body?: unknown) =>
  new Promise<RawResponse>((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      url,
      {
        method,
        headers: {
          ...(token ? { "X-Token": token } : {}),
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
        timeout: 15000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error(`Timed out on ${method} ${url.pathname}`)));
    req.on("error", reject);
    req.end(payload);
  });

const parseBody = (text: string): unknown => {
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export class WarudoRestClient {
  constructor(private readonly baseUrl: string) {}

  /** Request a path under /api. Retries once with a fresh token after a 401. */
  async request(method: HttpMethod, path: string, body?: unknown): Promise<unknown> {
    const url = new URL(`/api${path.startsWith("/") ? path : `/${path}`}`, this.baseUrl);
    const attempt = async () => {
      try {
        return await send(url, method, await getToken(), body);
      } catch (err) {
        throw new Error(`Cannot reach Warudo REST API at ${this.baseUrl}: ${(err as Error).message}`);
      }
    };
    let res = await attempt();
    if (res.status === 401) {
      invalidateToken();
      res = await attempt();
    }
    if (res.status === 401) throw new Error(tokenHint);
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Warudo REST API error: ${res.status} on ${method} ${url.pathname}: ${res.body.slice(0, 500)}`);
    }
    return parseBody(res.body);
  }

  get = (path: string) => this.request("GET", path);
}
