export interface Config {
  warudoWsUrl: string;
  warudoRestUrl: string;
  /** host:port for the Streamable HTTP transport; stdio when undefined. */
  httpListen?: string;
}

const argValue = (argv: string[], name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

export function loadConfig(argv: string[] = process.argv): Config {
  return {
    warudoWsUrl: process.env.WARUDO_WS_URL ?? "ws://localhost:19053",
    warudoRestUrl: process.env.WARUDO_REST_URL ?? "http://localhost:19052",
    httpListen: argValue(argv, "http") ?? process.env.WARUDO_MCP_HTTP,
  };
}
