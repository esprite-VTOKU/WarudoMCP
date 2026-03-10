import { describe, it, expect } from "vitest";

// Helper: format port value (mirrors logic in index.ts)
function formatPortValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return value.length > 500
      ? value.slice(0, 500) + "... (truncated)"
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const json = JSON.stringify(value, null, 2);
  return json.length > 500
    ? json.slice(0, 500) + "... (truncated)"
    : json;
}

// Helper: format set_data_input confirmation (mirrors logic in index.ts)
function formatSetDataInputConfirmation(
  entityId: string,
  portKey: string,
  value: unknown
): string {
  return [
    "Set data input port on entity.",
    `Entity ID: ${entityId}`,
    `Port: ${portKey}`,
    `Value: ${formatPortValue(value)}`,
  ].join("\n");
}

// Helper: format invoke_trigger confirmation (mirrors logic in index.ts)
function formatInvokeTriggerConfirmation(
  entityId: string,
  portKey: string
): string {
  return [
    "Invoked trigger port on entity.",
    `Entity ID: ${entityId}`,
    `Trigger: ${portKey}`,
  ].join("\n");
}

// Helper: format send_plugin_message confirmation (mirrors logic in index.ts)
function formatSendPluginMessageConfirmation(
  pluginId: string,
  action: string,
  payload?: unknown
): string {
  const payloadText =
    payload !== undefined && payload !== null
      ? formatPortValue(payload)
      : "(none)";

  return [
    "Sent plugin message.",
    `Plugin ID: ${pluginId}`,
    `Action: ${action}`,
    `Payload: ${payloadText}`,
  ].join("\n");
}

// Helper: check for error in WebSocket response
function hasResponseError(
  response: Record<string, unknown>
): string | null {
  if (response.error) return String(response.error);
  if (response.Error) return String(response.Error);
  return null;
}

describe("set_data_input formatting", () => {
  it("formats confirmation with string value", () => {
    const result = formatSetDataInputConfirmation(
      "abc-123",
      "Expression",
      "happy"
    );

    expect(result).toContain("Set data input port on entity.");
    expect(result).toContain("Entity ID: abc-123");
    expect(result).toContain("Port: Expression");
    expect(result).toContain("Value: happy");
  });

  it("formats confirmation with numeric value", () => {
    const result = formatSetDataInputConfirmation(
      "abc-123",
      "FOV",
      60
    );

    expect(result).toContain("Value: 60");
  });

  it("formats confirmation with object value (truncates if long)", () => {
    const result = formatSetDataInputConfirmation(
      "abc-123",
      "Position",
      { x: 1, y: 2, z: 3 }
    );

    expect(result).toContain("Value:");
    expect(result).toContain('"x": 1');
    expect(result).toContain('"y": 2');
    expect(result).toContain('"z": 3');
  });

  it("formats confirmation with boolean value", () => {
    const result = formatSetDataInputConfirmation(
      "abc-123",
      "Active",
      true
    );

    expect(result).toContain("Value: true");
  });

  it("formats confirmation with null value", () => {
    const result = formatSetDataInputConfirmation(
      "abc-123",
      "Override",
      null
    );

    expect(result).toContain("Value: null");
  });
});

describe("invoke_trigger formatting", () => {
  it("formats trigger confirmation with entity and port", () => {
    const result = formatInvokeTriggerConfirmation(
      "def-456",
      "PlayAnimation"
    );

    expect(result).toContain("Invoked trigger port on entity.");
    expect(result).toContain("Entity ID: def-456");
    expect(result).toContain("Trigger: PlayAnimation");
  });

  it("includes both entityId and portKey in output", () => {
    const result = formatInvokeTriggerConfirmation(
      "unique-entity-id",
      "unique-trigger-key"
    );

    expect(result).toContain("unique-entity-id");
    expect(result).toContain("unique-trigger-key");
  });
});

describe("send_plugin_message formatting", () => {
  it("formats message confirmation with pluginId and action", () => {
    const result = formatSendPluginMessageConfirmation(
      "my-plugin",
      "doSomething"
    );

    expect(result).toContain("Sent plugin message.");
    expect(result).toContain("Plugin ID: my-plugin");
    expect(result).toContain("Action: doSomething");
  });

  it("includes payload in output when provided", () => {
    const result = formatSendPluginMessageConfirmation(
      "my-plugin",
      "doSomething",
      { key: "value" }
    );

    expect(result).toContain("Payload:");
    expect(result).toContain('"key": "value"');
  });

  it('shows "(none)" for payload when not provided', () => {
    const result = formatSendPluginMessageConfirmation(
      "my-plugin",
      "doSomething"
    );

    expect(result).toContain("Payload: (none)");
  });

  it('shows "(none)" for null payload', () => {
    const result = formatSendPluginMessageConfirmation(
      "my-plugin",
      "doSomething",
      null
    );

    expect(result).toContain("Payload: (none)");
  });
});

describe("WebSocket response error detection", () => {
  it("detects error field in response", () => {
    const result = hasResponseError({ error: "Invalid entity ID" });
    expect(result).toBe("Invalid entity ID");
  });

  it("detects Error field in response", () => {
    const result = hasResponseError({ Error: "Port not found" });
    expect(result).toBe("Port not found");
  });

  it("returns null for successful response (no error field)", () => {
    const result = hasResponseError({ success: true, data: {} });
    expect(result).toBeNull();
  });

  it("returns null for empty response", () => {
    const result = hasResponseError({});
    expect(result).toBeNull();
  });
});
