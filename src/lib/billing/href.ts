import { BACK } from "@/lib/back";
import { safeInternalPath } from "@/lib/auth/next-path";

const APP_PREFIXES = [
  "/painel",
  "/box",
  "/largada",
  "/empresas",
  "/grid",
  "/lead",
  "/listas",
  "/crm",
  "/conta",
  "/setup",
  "/conexoes",
  "/admin",
] as const;

export function pathWithSearch(pathname: string, search: string): string {
  const q = search.startsWith("?") ? search.slice(1) : search;
  return q ? `${pathname}?${q}` : pathname;
}

function pathnameOf(path: string): string {
  return path.split("?")[0]?.split("#")[0] ?? path;
}

function isBillingLoop(path: string): boolean {
  const pathname = pathnameOf(path);
  return (
    pathname === "/planos" ||
    pathname === "/pagar" ||
    pathname === "/entrar" ||
    pathname.startsWith("/planos/") ||
    pathname.startsWith("/pagar/") ||
    pathname.startsWith("/entrar/")
  );
}

function isAppPath(path: string): boolean {
  const pathname = pathnameOf(path);
  return APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Sanitized origin for billing return. Null when missing, unsafe, or a loop. */
export function billingOrigin(from: string | null | undefined): string | null {
  if (!from) return null;
  const path = safeInternalPath(from, "");
  if (!path || path === "/" || isBillingLoop(path)) return null;
  return path;
}

export function withFrom(href: string, from: string | null | undefined): string {
  const origin = billingOrigin(from);
  if (!origin) return href;
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const encoded = encodeURIComponent(origin).replace(/%2F/g, "/");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}from=${encoded}${hash}`;
}

export function planosHref(from?: string | null, recarga = false): string {
  return withFrom(recarga ? "/planos#recarga" : "/planos", from);
}

export function pagarHref(sku: string, from?: string | null): string {
  return withFrom(`/pagar?sku=${encodeURIComponent(sku)}`, from);
}

export function pagarSucessoHref(orderId: string, from?: string | null): string {
  return withFrom(
    `/pagar/sucesso?order=${encodeURIComponent(orderId)}`,
    from,
  );
}

export function pagarPendenteHref(orderId: string, from?: string | null): string {
  return withFrom(
    `/pagar/pendente?order=${encodeURIComponent(orderId)}`,
    from,
  );
}

function billingReturnLabel(path: string): string {
  const pathname = pathnameOf(path);
  if (pathname === "/painel" || pathname.startsWith("/painel/")) {
    return BACK.painel.label;
  }
  if (pathname === "/box" || pathname.startsWith("/box/")) return BACK.box.label;
  if (pathname === "/conta" || pathname.startsWith("/conta/")) {
    return "Voltar à conta";
  }
  if (pathname === "/listas" || pathname.startsWith("/listas/")) {
    return BACK.listas.label;
  }
  if (pathname === "/empresas" || pathname.startsWith("/empresas/")) {
    return BACK.empresas.label;
  }
  if (pathname === "/largada" || pathname.startsWith("/largada/")) {
    return BACK.largada.label;
  }
  if (pathname === "/crm" || pathname.startsWith("/crm/")) return "Voltar ao CRM";
  if (pathname.startsWith("/lead/")) return "Voltar à ficha";
  if (pathname.startsWith("/grid/")) return "Voltar à lista";
  if (pathname === "/conexoes" || pathname.startsWith("/conexoes/")) {
    return "Voltar às conexões";
  }
  return "Voltar";
}

export function billingReturn(
  from: string | null | undefined,
  fallback: { href: string; label: string } = BACK.inicio,
): { href: string; label: string } {
  const origin = billingOrigin(from);
  if (!origin) return fallback;
  return { href: origin, label: billingReturnLabel(origin) };
}

export function billingSuccessReturn(
  from: string | null | undefined,
): { href: string; label: string } {
  const origin = billingOrigin(from);
  if (!origin || !isAppPath(origin)) {
    return { href: "/painel", label: "Ir ao Painel" };
  }
  if (pathnameOf(origin) === "/painel") {
    return { href: origin, label: "Ir ao Painel" };
  }
  if (pathnameOf(origin) === "/box") {
    return { href: origin, label: "Ir a ligar" };
  }
  return { href: origin, label: billingReturnLabel(origin) };
}
