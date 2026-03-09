import { describe, it, expect } from "vitest";
import { WarudoWebSocketClient } from "../warudo/websocket-client.js";

describe("WarudoWebSocketClient", () => {
  it("starts in disconnected state", () => {
    const client = new WarudoWebSocketClient("ws://localhost:19053");
    expect(client.getState()).toBe("disconnected");
  });

  it("ensureConnected calls connect when disconnected", async () => {
    const client = new WarudoWebSocketClient("ws://localhost:99999");
    // This should attempt to connect and fail (no server running)
    await expect(client.ensureConnected()).rejects.toThrow();
  });
});
