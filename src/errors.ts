export function warudoError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
