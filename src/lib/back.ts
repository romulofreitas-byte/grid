export const BACK = {
  inicio: { href: "/", label: "Voltar ao início" },
  box: { href: "/box", label: "Voltar ao Box" },
  setup: { href: "/setup", label: "Voltar ao capacete" },
  largada: { href: "/largada", label: "Voltar à nova lista" },
  listas: { href: "/listas", label: "Voltar às Listas" },
  empresas: { href: "/empresas", label: "Voltar às empresas" },
} as const;

export const largadaNovaHref = "/largada?nova=1";

export type ConexoesKind = "crm" | "dialer" | "voip" | "webhook";

export function conexoesHref(kind?: ConexoesKind) {
  return kind ? `/conexoes?kind=${kind}` : "/conexoes";
}

export type GridFrom = "box" | "largada" | "listas";

export function parseGridFrom(value: string | null): GridFrom {
  if (value === "largada" || value === "listas" || value === "box") {
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
      label: "Voltar ao Grid",
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
