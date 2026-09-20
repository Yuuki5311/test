/** Expand undici/Node "fetch failed" with underlying cause when present. */
export function formatFetchError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const parts = [e.message];
  const cause = (e as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code;
    parts.push(code ? `${cause.message} [${code}]` : cause.message);
  } else if (cause != null) {
    parts.push(String(cause));
  }
  return parts.filter(Boolean).join(" · ");
}
