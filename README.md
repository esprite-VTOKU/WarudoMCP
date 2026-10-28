# WarudoMCP

An MCP (Model Context Protocol) server that gives AI assistants control over [Warudo](https://warudo.app), the 3D VTubing software. Connect Claude, Cursor, or any MCP client to inspect and change assets, scenes, and blueprints.

Tested against Warudo 0.15.1 on Windows 11.

## Features

- **Scene inspection** — list assets and blueprints, read asset and node ports, query plugins and saved scenes
- **Asset control** — set data input values, invoke triggers, send plugin messages
- **Blueprints** — inspect, create, enable/disable, rename, and remove blueprint graphs
- **Type discovery** — search the node and asset types that the loaded plugins provide
- **Raw access** — send any editor-protocol request or REST call, for investigation

## How it connects

WarudoMCP speaks the same protocol as the Warudo editor:

- REST API on `http://localhost:19052/api` (scene, scenes, about)
- Editor WebSocket on `ws://localhost:19053`, with JSON frames `{ "action": ..., "data": ... }`

Both APIs accept only loopback connections and need an auth token. Warudo makes a new token at each launch and passes it to its editor as `--token=...`. WarudoMCP reads the token from the running editor process on Windows, so **keep the Warudo editor window open**. Set `WARUDO_TOKEN` to use a token you supply instead.

## Prerequisites

- [Node.js](https://nodejs.org) 22 LTS or later, on the same Windows machine as Warudo
- Warudo running, with its editor window open

## Installation

```bash
git clone https://github.com/esprite-VTOKU/WarudoMCP.git
cd WarudoMCP
npm install
npm run build
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WARUDO_WS_URL` | `ws://localhost:19053` | Warudo editor WebSocket URL |
| `WARUDO_REST_URL` | `http://localhost:19052` | Warudo REST API URL |
| `WARUDO_TOKEN` | read from the editor process | Warudo auth token |
| `WARUDO_MCP_HTTP` | unset (stdio) | `host:port` to serve Streamable HTTP; same as `--http=host:port` |

## MCP client setup

### Same machine (stdio)

Claude Desktop (`claude_desktop_config.json`) or Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "warudo": {
      "command": "node",
      "args": ["C:/path/to/WarudoMCP/build/index.js"]
    }
  }
}
```

### Another machine (HTTP)

Warudo's APIs do not accept remote connections, so run WarudoMCP next to Warudo and serve MCP over HTTP:

```bash
node build/index.js --http=0.0.0.0:8765
```

Then point the client at `http://<warudo-host>:8765/mcp`, for example:

```bash
claude mcp add --transport http warudo http://192.168.1.100:8765/mcp
```

The HTTP endpoint has no authentication. Anyone who can reach the port can control Warudo, so allow the port only from a trusted network (for example, a Windows Firewall rule with a remote-address scope).

## Tools

| Tool | Description |
|------|-------------|
| `ping` | Check that the editor WebSocket accepts this server |
| `check_connection` | Check REST and WebSocket access and report the Warudo version |
| `get_server_info` | Warudo version, loaded plugins, saved scenes, opened scene |
| `list_scenes` | List saved scenes |
| `list_assets` | List assets in the opened scene, with an optional type filter |
| `get_asset_details` | Read data input ports and triggers of an asset or a blueprint node |
| `set_data_input` | Set a data input port on an asset or node |
| `invoke_trigger` | Invoke a trigger on an asset or node |
| `send_plugin_message` | Send a message to a loaded plugin |
| `list_blueprints` | List blueprint graphs in the opened scene |
| `get_blueprint` | Show a blueprint's nodes and flow and data connections |
| `create_blueprint` | Create a blueprint from nodes and connections |
| `manage_blueprint` | Enable, disable, rename, or remove a blueprint |
| `list_types` | Search node types or asset types from the loaded plugins |
| `warudo_request` | Send a raw editor-protocol request and return the reply |
| `warudo_rest` | Call a REST endpoint under `/api` and return the body |

`create_blueprint` takes node types by ID, title, or class name (for example `OnKeystrokePressed` or `Show Toast`). Use `list_types` to find them, and `get_asset_details` on a node to find its port keys.

## Usage examples

- "What assets are in my Warudo scene?"
- "Set the camera field of view to 40"
- "Show me the nodes in the Face Tracking blueprint"
- "Create a blueprint that shows a toast when I press Escape"
- "Export the Face Tracking blueprint as JSON"

## Development

```bash
npm run dev      # Watch mode with tsx
npm test         # Run tests
npm run build    # Compile TypeScript
npm start        # Run compiled server
```

## License

ISC
