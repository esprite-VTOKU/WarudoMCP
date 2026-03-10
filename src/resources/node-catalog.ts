/** Curated Warudo node type reference catalog for AI blueprint generation. */
export const NODE_CATALOG_TEXT = `# Warudo Node Type Reference

This catalog describes common Warudo blueprint node types, their ports, and connection patterns.
Use this reference when generating blueprints with the create_blueprint tool.

## How Blueprints Work

Warudo blueprints are visual graphs with **nodes** connected by **flow connections** (execution order) and **data connections** (passing values).

- **Flow connections** use "Exit" (source) -> "Enter" (dest) ports to control execution order
- **Data connections** pass values between nodes (e.g., a character reference from one node to another)
- Nodes are referenced by their index in the nodes array (0-based) when creating connections
- Every blueprint needs at least one **event node** to trigger execution

## Event Nodes (Triggers — Start Execution)

### OnKeyPressNode
Fires when a keyboard key is pressed.
- **Flow Outputs:** Exit
- **Data Inputs:** Key (string — e.g., "Space", "A", "Return", "LeftShift", "Alpha1")
- **Data Outputs:** (none)
- **Pattern:** Always the first node in a "when key pressed" blueprint

### OnUpdateNode
Fires every frame (use sparingly — high performance cost).
- **Flow Outputs:** Exit
- **Data Outputs:** DeltaTime (float)

## Action Nodes

### PlayAnimationNode
Plays an animation on a character asset.
- **Flow Inputs:** Enter
- **Flow Outputs:** Exit, OnComplete
- **Data Inputs:** Target (entity reference), Animation (string — animation clip name), Speed (float, default 1.0), FadeIn (float, default 0.2), Layer (int, default 0)
- **Note:** Target should be connected to a GetAssetNode or set to a character entity ID

### SetExpressionNode
Changes a character's facial expression.
- **Flow Inputs:** Enter
- **Flow Outputs:** Exit
- **Data Inputs:** Target (entity reference), Expression (string — expression name), Weight (float 0-1, default 1.0), FadeTime (float, default 0.3)

### ToggleAssetNode
Enables or disables an asset in the scene.
- **Flow Inputs:** Enter
- **Flow Outputs:** Exit
- **Data Inputs:** Target (entity reference), Enabled (bool)

### SetDataInputNode
Sets a data input port value on any entity.
- **Flow Inputs:** Enter
- **Flow Outputs:** Exit
- **Data Inputs:** Target (entity reference), PortKey (string), Value (any)

## Flow Control Nodes

### WaitNode
Pauses execution for a duration.
- **Flow Inputs:** Enter
- **Flow Outputs:** Exit
- **Data Inputs:** Duration (float — seconds)

### BranchNode
Conditional branch (if/else).
- **Flow Inputs:** Enter
- **Flow Outputs:** True, False
- **Data Inputs:** Condition (bool)

### SequenceNode
Executes multiple flow outputs in order.
- **Flow Inputs:** Enter
- **Flow Outputs:** Out0, Out1, Out2, Out3

## Data Nodes

### GetAssetNode
Gets a reference to an asset by name or ID.
- **Data Inputs:** AssetName (string) or AssetId (string)
- **Data Outputs:** Asset (entity reference)
- **Note:** Use this to get character/prop references for action nodes

### FloatNode
Constant float value.
- **Data Inputs:** Value (float)
- **Data Outputs:** Value (float)

### StringNode
Constant string value.
- **Data Inputs:** Value (string)
- **Data Outputs:** Value (string)

## Common Blueprint Patterns

### Pattern: "When I press [key], play [animation]"
\`\`\`json
{
  "name": "Key Press Animation",
  "nodes": [
    { "typeId": "OnKeyPressNode", "dataInputs": { "Key": "Space" } },
    { "typeId": "PlayAnimationNode", "dataInputs": { "Animation": "wave" } }
  ],
  "flowConnections": [
    { "sourceNodeIndex": 0, "sourcePort": "Exit", "destNodeIndex": 1, "destPort": "Enter" }
  ]
}
\`\`\`

### Pattern: "When I press [key], change expression to [expression]"
\`\`\`json
{
  "name": "Key Press Expression",
  "nodes": [
    { "typeId": "OnKeyPressNode", "dataInputs": { "Key": "F1" } },
    { "typeId": "SetExpressionNode", "dataInputs": { "Expression": "happy", "Weight": 1.0 } }
  ],
  "flowConnections": [
    { "sourceNodeIndex": 0, "sourcePort": "Exit", "destNodeIndex": 1, "destPort": "Enter" }
  ]
}
\`\`\`

### Pattern: "When I press [key], do [action] then wait then do [action2]"
\`\`\`json
{
  "name": "Key Press Sequence",
  "nodes": [
    { "typeId": "OnKeyPressNode", "dataInputs": { "Key": "Space" } },
    { "typeId": "PlayAnimationNode", "dataInputs": { "Animation": "wave" } },
    { "typeId": "WaitNode", "dataInputs": { "Duration": 2.0 } },
    { "typeId": "SetExpressionNode", "dataInputs": { "Expression": "smile" } }
  ],
  "flowConnections": [
    { "sourceNodeIndex": 0, "sourcePort": "Exit", "destNodeIndex": 1, "destPort": "Enter" },
    { "sourceNodeIndex": 1, "sourcePort": "Exit", "destNodeIndex": 2, "destPort": "Enter" },
    { "sourceNodeIndex": 2, "sourcePort": "Exit", "destNodeIndex": 3, "destPort": "Enter" }
  ]
}
\`\`\`

### Pattern: "Toggle [asset] when I press [key]"
\`\`\`json
{
  "name": "Toggle Asset",
  "nodes": [
    { "typeId": "OnKeyPressNode", "dataInputs": { "Key": "T" } },
    { "typeId": "ToggleAssetNode", "dataInputs": { "Enabled": true } }
  ],
  "flowConnections": [
    { "sourceNodeIndex": 0, "sourcePort": "Exit", "destNodeIndex": 1, "destPort": "Enter" }
  ]
}
\`\`\`

## Tips for Blueprint Generation

- Always start with an **event node** (OnKeyPressNode, OnUpdateNode) — blueprints need a trigger
- Connect flow ports to control execution order: source "Exit" -> dest "Enter"
- Node type IDs may be descriptive names or GUIDs — use descriptive names when possible
- Use list_node_types to discover additional node types available in the user's Warudo instance
- If a blueprint fails to import, check: node type IDs exist, port names are correct, connection indices are valid
- When unsure about a node type or its ports, ask the user for clarification rather than guessing
- For character actions (play animation, set expression), the character entity needs to be referenced — either via a GetAssetNode data connection or by using list_assets to find the character's entity ID
`;

/** Returns the MCP resource handler for the node catalog. */
export function getNodeCatalogResource() {
  return async () => ({
    contents: [
      {
        uri: "warudo://node-catalog",
        text: NODE_CATALOG_TEXT,
        mimeType: "text/markdown" as const,
      },
    ],
  });
}
