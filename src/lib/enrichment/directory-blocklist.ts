/** Hosts that are never a company's own site. */
export const DIRECTORY_BLOCKLIST = [
  // cadastro / CNPJ
  "cnpj.biz",
  "cnpjcheck.com.br",
  "cnpja.com",
  "casadosdados.com.br",
  "casadosdados",
  "econodata.com.br",
  "econodata",
  "empresascnpj.com.br",
  "empresascnpj",
  "consultacnpj.com",
  "receitaws.com.br",
  "brasil.io",
  "mapaosc.ipea.gov.br",
  // listas / guias
  "apontador.com.br",
  "apontador",
  "telelistas.com.br",
  "telelistas",
  "guiamais.com.br",
  "guiamais",
  "solutudo.com.br",
  "solutudo",
  "reclameaqui.com.br",
  "reclameaqui",
  "jusbrasil.com.br",
  "jusbrasil",
  "escavador.com",
  "escavador",
  "tripadvisor.com",
  "glassdoor.com",
  "indeed.com",
  // escolas / educação (portais, não o site da instituição)
  "escolasbrasil.org",
  "escolas.com.br",
  "qedu.org.br",
  "educamaisbrasil.com.br",
  "melhorescola.com.br",
  "inep.gov.br",
  "educacao.mg.gov.br",
  // redes / perfis
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "google.com",
  "maps.google.com",
  // portais / webmail — nunca site da empresa
  "uai.com.br",
  "uai.com",
  "globo.com",
  "r7.com",
  "uol.com.br",
  "terra.com.br",
  "ig.com.br",
  "wikipedia.org",
  "wikidata.org",
];

function hostnameOf(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "";
  try {
    const href = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/\//, "")}`;
    return new URL(href).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return trimmed.replace(/^www\./, "");
  }
}

export function isDirectoryUrl(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  return DIRECTORY_BLOCKLIST.some((d) => {
    const needle = d.replace(/^www\./, "").toLowerCase();
    if (needle.includes(".")) {
      return host === needle || host.endsWith(`.${needle}`);
    }
    return host === needle || host.includes(needle);
  });
}
