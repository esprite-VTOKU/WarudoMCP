import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns defaults when no env vars set", () => {
    delete process.env.WARUDO_WS_URL;
    delete process.env.WARUDO_REST_URL;

    const config = loadConfig();
    expect(config.warudoWsUrl).toBe("ws://localhost:19053");
    expect(config.warudoRestUrl).toBe("http://localhost:19052");
  });

  it("reads WARUDO_WS_URL and WARUDO_REST_URL from process.env", () => {
    process.env.WARUDO_WS_URL = "ws://192.168.1.100:19053";
    process.env.WARUDO_REST_URL = "http://192.168.1.100:19052";

    const config = loadConfig();
    expect(config.warudoWsUrl).toBe("ws://192.168.1.100:19053");
    expect(config.warudoRestUrl).toBe("http://192.168.1.100:19052");
  });
});
