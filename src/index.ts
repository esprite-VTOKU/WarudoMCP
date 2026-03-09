#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { WarudoWebSocketClient } from "./warudo/websocket-client.js";
import { WarudoRestClient } from "./warudo/rest-client.js";
import { warudoError } from "./errors.js";

const server = new McpServer({ name: "warudo-mcp", version: "0.1.0" });

const config = loadConfig();
const wsClient = new WarudoWebSocketClient(config.warudoWsUrl);
const restClient = new WarudoRestClient(config.warudoRestUrl);

server.tool("ping", "Check if the MCP server is running and can reach Warudo", {}, async () => {
  try {
    await wsClient.ensureConnected();
    return {
      content: [
        {
          type: "text",
          text: `pong! Warudo WebSocket is ${wsClient.getState()} at ${config.warudoWsUrl}`,
        },
      ],
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error connecting to Warudo";
    return warudoError(
      `Cannot reach Warudo: ${message}\n\nWebSocket state: ${wsClient.getState()}\nMake sure Warudo is running with WebSocket enabled on ${config.warudoWsUrl}`
    );
  }
});

server.tool(
  "check_connection",
  "Check connectivity to both Warudo WebSocket and REST APIs",
  {},
  async () => {
    const results: string[] = [];

    // Check WebSocket
    try {
      await wsClient.ensureConnected();
      results.push(`WebSocket: connected (${config.warudoWsUrl})`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      results.push(`WebSocket: error - ${message}`);
    }

    // Check REST API
    try {
      const about = await restClient.getAbout();
      const version =
        about && typeof about === "object" && "version" in about
          ? (about as Record<string, unknown>).version
          : "unknown";
      results.push(
        `REST API: connected (${config.warudoRestUrl})\nWarudo version: ${version}`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      results.push(`REST API: error - ${message}`);
    }

    const anyError = results.some((r) => r.includes("error -"));
    const text = results.join("\n");

    if (anyError) {
      return warudoError(text);
    }

    return { content: [{ type: "text", text }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("warudo-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting warudo-mcp:", err);
  process.exit(1);
});
