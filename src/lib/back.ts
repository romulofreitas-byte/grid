export const BACK = {
  inicio: { href: "/", label: "Voltar ao início" },
  box: { href: "/box", label: "Voltar ao Início" },
  setup: { href: "/setup", label: "Voltar ao perfil" },
  largada: { href: "/largada", label: "Voltar à nova lista" },
  listas: { href: "/listas", label: "Voltar às Listas" },
  empresas: { href: "/empresas", label: "Voltar às empresas" },
} as const;

export const largadaNovaHref = "/largada?nova=1";

export type ConexoesKind = "crm" | "dialer" | "voip" | "webhook";

export function conexoesHref(kind?: ConexoesKind) {
  return kind ? `/conexoes?kind=${kind}` : "/conexoes";
}

export type GridFrom = "box" | "largada" | "listas" | "empresas";

export function parseGridFrom(value: string | null): GridFrom {
  if (
    value === "largada" ||
    value === "listas" ||
    value === "box" ||
    value === "empresas"
  ) {
    return value;
  }
  return "box";
}

export function largadaEditHref(searchId: string, from: GridFrom = "box") {
  return `/largada?fromSearch=${encodeURIComponent(searchId)}&from=${from}`;
}

export function gridBack(from: string | null, searchId?: string) {
  const origin = parseGridFrom(from);
  if (origin === "largada" && searchId) {
    return {
      href: largadaEditHref(searchId, "largada"),
      label: BACK.largada.label,
    };
  }
  return BACK[origin];
}

export function leadBack(searchId: string | null | undefined, from: string | null) {
  if (searchId) {
    const origin = parseGridFrom(from);
    return {
      href: `/grid/${searchId}?from=${origin}`,
      label: "Voltar à lista",
    };
  }
  if (from === "empresas") return BACK.empresas;
  return BACK.box;
}

export function gridHref(searchId: string, from: GridFrom) {
  return `/grid/${searchId}?from=${from}`;
}

export function leadHref(cnpj: string, searchId: string, from: GridFrom) {
  return `/lead/${cnpj}?searchId=${searchId}&from=${from}`;
}

export function leadHrefForCnpj(cnpj: string, searchId?: string | null) {
  const id = cnpj.replace(/\D/g, "").padStart(14, "0");
  if (searchId) return `/lead/${id}?searchId=${encodeURIComponent(searchId)}&from=listas`;
  return `/lead/${id}`;
}

export function crmHref(opts?: { pipeline?: string; deal?: string }) {
  const params = new URLSearchParams();
  if (opts?.pipeline) params.set("pipeline", opts.pipeline);
  if (opts?.deal) params.set("deal", opts.deal);
  const query = params.toString();
  return query ? `/crm?${query}` : "/crm";
}
