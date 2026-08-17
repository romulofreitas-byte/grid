const FALLBACK = "/box";

/** Only same-origin relative paths. Blocks open redirects. */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = FALLBACK,
): string {
  if (!raw) return fallback;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  if (value.includes("\\")) return fallback;
  if (/[\0\r\n]/.test(value)) return fallback;
  if (value.startsWith("/entrar") && !value.startsWith("/entrar?go=1")) {
    return fallback;
  }
  return value;
}

export function isPaymentNext(path: string): boolean {
  return path.startsWith("/pagar") || path.startsWith("/planos");
}
