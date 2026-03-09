import { describe, it, expect, vi } from "vitest";
import { WarudoRestClient } from "../warudo/rest-client.js";

describe("WarudoRestClient", () => {
  it("getAbout fetches GET {baseUrl}/api/about", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: "1.0" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new WarudoRestClient("http://localhost:19052");
    await client.getAbout();

    expect(mockFetch).toHaveBeenCalledWith("http://localhost:19052/api/about");
    vi.unstubAllGlobals();
  });

  it("getScenes fetches GET {baseUrl}/api/scenes", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new WarudoRestClient("http://localhost:19052");
    await client.getScenes();

    expect(mockFetch).toHaveBeenCalledWith("http://localhost:19052/api/scenes");
    vi.unstubAllGlobals();
  });
});
