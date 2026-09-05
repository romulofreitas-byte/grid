export const APP_HOME = "/painel";
export const SETUP_PATH = "/setup";

const FALLBACK = APP_HOME;

function pathnameOf(path: string): string {
  return path.split("?")[0]?.split("#")[0] ?? path;
}

/** Home (or Box) without an explicit destination — first login can go to setup. */
export function isDefaultAppHome(path: string): boolean {
  const pathname = pathnameOf(path);
  return pathname === APP_HOME || pathname === "/box";
}

export function unwrapAuthDest(dest: string): string {
  if (!dest.startsWith("/entrar?go=1")) return dest;
  const query = dest.includes("?") ? dest.slice(dest.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query);
  return safeInternalPath(params.get("next"));
}

/** After login: incomplete onboarding lands on /setup instead of Painel/Box. */
export function authLandingPath(
  dest: string,
  onboardingCompleted: boolean,
): string {
  const unwrapped = unwrapAuthDest(dest);
  if (onboardingCompleted) return unwrapped;
  if (isDefaultAppHome(unwrapped)) return SETUP_PATH;
  return unwrapped;
}

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

/** Where a signed-in visitor to `/entrar` should go, or null to stay (lights / set password). */
export function signedInEntrarDestination(
  searchParams: Pick<URLSearchParams, "get">,
): string | null {
  if (searchParams.get("go") === "1") return null;
  if (searchParams.get("definir") === "1") return null;
  return safeInternalPath(searchParams.get("next"));
}
