export type ShellTone = "dark" | "light";

export function pathShellTone(pathname: string): ShellTone {
  return pathname === "/box" || pathname.startsWith("/box/") ? "light" : "dark";
}

export function hrefPathname(
  href: string | null | undefined,
  origin: string,
): string | null {
  const nav = sameOriginNavHref(href, origin);
  if (!nav) return null;
  try {
    return new URL(nav, origin).pathname;
  } catch {
    return null;
  }
}

export function sameOriginNavHref(
  href: string | null | undefined,
  origin: string,
): string | null {
  if (!href || href.startsWith("#")) return null;
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function pathMatchesDest(pathname: string, destPath: string): boolean {
  if (pathname === destPath || pathname === `${destPath}/`) return true;
  return destPath !== "/" && pathname.startsWith(`${destPath}/`);
}
