export const APP_HOME = "/painel";

const FALLBACK = APP_HOME;

/** Only same-origin relative paths. Blocks open redirects. */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = FALLBACK,
): string {
  if (!raw) return fallback;
  let value = raw.trim();
  if (!value.startsWith("/")) {
    try {
      value = decodeURIComponent(value);
    } catch {
      return fallback;
    }
  }
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  if (value.includes("\\")) return fallback;
  if (/[\0\r\n]/.test(value)) return fallback;
  if (value.startsWith("/entrar") && !isAllowedEntrarPath(value)) {
    return fallback;
  }
  return value;
}

function isAllowedEntrarPath(value: string): boolean {
  return (
    value === "/entrar?go=1" ||
    value.startsWith("/entrar?go=1&") ||
    value === "/entrar?definir=1" ||
    value.startsWith("/entrar?definir=1&")
  );
}

export function isPaymentNext(path: string): boolean {
  return path.startsWith("/pagar") || path.startsWith("/planos");
}
