# WarudoMCP
UNTESTED - STILL IN PROGRESS

An MCP (Model Context Protocol) server that gives AI assistants full control over [Warudo](https://warudo.app), the 3D VTubing software. Connect Claude, Cursor, or any MCP client to manipulate avatars, manage scenes, and generate blueprints through natural language.

## Features

- **Scene Inspection** — List assets, read properties, query server info and available scenes
- **Asset Control** — Set data input values, invoke triggers, send plugin messages
- **Blueprint Management** — Create, list, enable/disable, and remove blueprint graphs
- **Blueprint Generation** — Node type discovery and a curated catalog to help AI generate blueprints from natural language descriptions

## Prerequisites

- [Node.js](https://nodejs.org) 22 LTS or later
- [Warudo](https://warudo.app) running with WebSocket API (default port 19053) and REST API (default port 19052)

## Installation

```bash
git clone https://github.com/esprite-VTOKU/WarudoMCP.git
cd WarudoMCP
npm install
npm run build
```

## Configuration

WarudoMCP connects to Warudo's APIs using environment variables. 

| Variable | Default | Description |
|----------|---------|-------------|
| `WARUDO_WS_URL` | `ws://localhost:19053` | Warudo WebSocket API URL |
| `WARUDO_REST_URL` | `http://localhost:19052` | Warudo REST API URL |

## MCP Client Setup

### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "warudo": {
      "command": "node",
      "args": ["/absolute/path/to/WarudoMCP/build/index.js"]
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "warudo": {
      "command": "node",
      "args": ["/absolute/path/to/WarudoMCP/build/index.js"]
    }
  }
}
```

### Custom environment variables

```json
{
  "mcpServers": {
    "warudo": {
      "command": "node",
      "args": ["/absolute/path/to/WarudoMCP/build/index.js"],
      "env": {
        "WARUDO_WS_URL": "ws://192.168.1.100:19053",
        "WARUDO_REST_URL": "http://192.168.1.100:19052"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `ping` | Check if the MCP server can reach Warudo |
| `check_connection` | Test both WebSocket and REST API connectivity |
| `get_server_info` | Get Warudo version, loaded plugins, and available scenes |
| `list_scenes` | List all available scene files |
| `list_assets` | List all assets in the current scene (with optional type filter) |
| `get_asset_details` | Read data input port values for a specific asset |
| `set_data_input` | Set a data input port value on an asset or node |
| `invoke_trigger` | Invoke a trigger port (e.g., play animation, take screenshot) |
| `send_plugin_message` | Send a message to a Warudo plugin |
| `list_blueprints` | List all blueprint graphs in the current scene |
| `create_blueprint` | Create a new blueprint graph with nodes and connections |
| `manage_blueprint` | Enable, disable, or remove a blueprint graph |
| `list_node_types` | Discover node types used in scene blueprints |

## Resources

| Resource | Description |
|----------|-------------|
| `warudo://node-catalog` | Curated reference of common Warudo node types, ports, and blueprint patterns |

## Usage Examples

Once connected, ask your AI assistant things like:

- "What assets are in my Warudo scene?"
- "Move the camera to position (0, 1.5, -3)"
- "Change my character's expression to happy"
- "Create a blueprint that plays a wave animation when I press spacebar"
- "List all the blueprints and disable the one called 'test'"

## Development

```bash
npm run dev      # Watch mode with tsx
npm test         # Run tests
npm run build    # Compile TypeScript
npm start        # Run compiled server
```

## License

ISC
