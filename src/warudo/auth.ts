import { execFile } from "node:child_process";

// Warudo 0.15 starts its editor as `warudo-client-electron.exe --token=<token>`.
// The editor sends that token as the WebSocket subprotocol and as the REST
// `X-Token` header. A new token is issued per Warudo launch, so discover it
// from the running editor unless WARUDO_TOKEN pins one.

let cached: string | undefined;

export const parseToken = (commandLines: string): string | undefined =>
  /--token=("?)([^\s"]+)\1/.exec(commandLines)?.[2];

const editorCommandLines = (): Promise<string> =>
  new Promise((resolve) => {
    if (process.platform !== "win32") return resolve("");
    const script =
      "(Get-CimInstance Win32_Process -Filter \"Name='warudo-client-electron.exe'\" | Select-Object -ExpandProperty CommandLine) -join \"`n\"";
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, timeout: 15000 },
      (err, stdout) => resolve(err ? "" : stdout)
    );
  });

export async function getToken(): Promise<string | undefined> {
  if (process.env.WARUDO_TOKEN) return process.env.WARUDO_TOKEN;
  cached ??= parseToken(await editorCommandLines());
  return cached;
}

export function invalidateToken(): void {
  cached = undefined;
}

export const tokenHint =
  "Warudo rejected the auth token. Keep the Warudo editor window open (the token is read from its command line), or set WARUDO_TOKEN.";
