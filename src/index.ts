#!/usr/bin/env node

import http from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { buildServer, createClients } from "./server.js";

const config = loadConfig();
const clients = createClients(config);

const readJson = (req: http.IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(body ? JSON.parse(body) : undefined);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });

// Stateless Streamable HTTP: a fresh MCP server per request, sharing one
// Warudo WebSocket. Lets a client outside the VM reach Warudo, whose APIs
// accept only loopback connections.
function serveHttp(listen: string) {
  const sep = listen.lastIndexOf(":");
  const host = listen.slice(0, sep);
  const port = Number(listen.slice(sep + 1));
  http
    .createServer(async (req, res) => {
      if (new URL(req.url ?? "/", "http://x").pathname !== "/mcp") {
        res.writeHead(404).end();
        return;
      }
      try {
        const body = req.method === "POST" ? await readJson(req) : undefined;
        const server = buildServer(clients);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on("close", () => {
          transport.close();
          server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
      } catch (err) {
        console.error("MCP HTTP request failed:", err);
        if (!res.headersSent) res.writeHead(500).end();
      }
    })
    .listen(port, host, () => console.error(`warudo-mcp listening on http://${host}:${port}/mcp`));
}

async function main() {
  if (config.httpListen) return serveHttp(config.httpListen);
  await buildServer(clients).connect(new StdioServerTransport());
  console.error("warudo-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting warudo-mcp:", err);
  process.exit(1);
});
