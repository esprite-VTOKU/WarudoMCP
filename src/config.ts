export interface Config {
  warudoWsUrl: string;
  warudoRestUrl: string;
}

export function loadConfig(): Config {
  return {
    warudoWsUrl: process.env.WARUDO_WS_URL ?? "ws://localhost:19053",
    warudoRestUrl: process.env.WARUDO_REST_URL ?? "http://localhost:19052",
  };
}
