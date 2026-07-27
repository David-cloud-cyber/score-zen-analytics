export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  // Local error logging only - disconnected from external Lovable cloud
  if (process.env.NODE_ENV !== "production") {
    console.error("[Local Error Reporter]", error, context);
  }
}
