export class WarudoRestClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getAbout(): Promise<unknown> {
    return this.get("/api/about");
  }

  async getScenes(): Promise<unknown> {
    return this.get("/api/scenes");
  }

  async openScene(sceneName: string): Promise<unknown> {
    return this.put("/api/openedScene", { name: sceneName });
  }

  private async get(path: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`);
    } catch {
      throw new Error(
        `Cannot reach Warudo REST API at ${this.baseUrl}. Is Warudo running?`
      );
    }
    if (!response.ok) {
      throw new Error(
        `Warudo REST API error: ${response.status} ${response.statusText} on GET ${path}`
      );
    }
    return response.json();
  }

  private async put(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error(
        `Cannot reach Warudo REST API at ${this.baseUrl}. Is Warudo running?`
      );
    }
    if (!response.ok) {
      throw new Error(
        `Warudo REST API error: ${response.status} ${response.statusText} on PUT ${path}`
      );
    }
    return response.json();
  }
}
