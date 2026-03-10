export function warudoError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

/** Extract error message from an unknown caught value. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Check a Warudo WebSocket response for error fields. Returns the error message or null. */
export function checkResponseError(response: Record<string, unknown>): string | null {
  if (response.error || response.Error) {
    return String(response.error ?? response.Error);
  }
  return null;
}
