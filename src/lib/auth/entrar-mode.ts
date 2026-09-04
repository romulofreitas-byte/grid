export type EntrarMode = "login" | "signup" | "recover" | "definir";

export function modeFromParams(params: URLSearchParams): EntrarMode {
  if (params.get("definir") === "1") return "definir";
  if (params.get("modo") === "recuperar") return "recover";
  if (params.get("modo") === "cadastro") return "signup";
  return "login";
}
