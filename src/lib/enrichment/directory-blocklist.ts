export const DIRECTORY_BLOCKLIST = [
  "cnpj.biz",
  "casadosdados",
  "econodata",
  "apontador",
  "telelistas",
  "guiamais",
  "solutudo",
  "empresascnpj",
  "reclameaqui",
  "jusbrasil",
  "escavador",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "google.com",
  "maps.google",
];

export function isDirectoryUrl(url: string): boolean {
  const host = url.toLowerCase();
  return DIRECTORY_BLOCKLIST.some((d) => host.includes(d));
}
