import { GOLDEN_MINUTE_PLACEHOLDER } from "@/lib/golden-minute";
import { DEFAULT_MEETING_MINUTES } from "@/lib/pilot-profile";
import type { MarketBrief, Profile } from "@/lib/types";

export type ScriptProfile = Pick<
  Profile,
  | "nome"
  | "como_chama"
  | "tratamento"
  | "empresa_usuario"
  | "cidade_usuario"
  | "especialidade"
  | "area"
  | "promessa"
  | "duracao_reuniao"
>;

export type AnatomyInput = {
  decisorNome?: string | null;
  market: Pick<
    MarketBrief,
    "nome" | "dorPrincipal" | "perguntaConsideracao" | "sazonalidade" | "sazonalidadeAtiva"
  >;
};

function slot(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function firstName(nome: string | null | undefined): string | null {
  const first = nome?.trim().split(/\s+/)[0];
  return first || null;
}

function artigo(profile: ScriptProfile): string {
  if (profile.tratamento === "a") return "a ";
  if (profile.tratamento === "e") return "e ";
  return "o ";
}

function motiveLine(
  market: AnatomyInput["market"],
): string {
  const dor = market.dorPrincipal.trim();
  const season =
    market.sazonalidadeAtiva && market.sazonalidade?.trim()
      ? ` ${market.sazonalidade.trim().replace(/\.*$/, "")}.`
      : "";
  return `A gente acompanha ${market.nome}. ${dor}.${season}`;
}

export function buildOpeningScript(
  profile: ScriptProfile,
  input: AnatomyInput,
): string {
  const decisor = firstName(input.decisorNome) ?? "aí";
  const comoChama = slot(profile.como_chama, slot(firstName(profile.nome), "Piloto"));
  const empresa = slot(profile.empresa_usuario, "empresa");
  const cidade = slot(profile.cidade_usuario, "cidade");
  const duracao = profile.duracao_reuniao || DEFAULT_MEETING_MINUTES;
  const pergunta =
    input.market.perguntaConsideracao.trim() || GOLDEN_MINUTE_PLACEHOLDER;

  return [
    `Olá ${decisor}, aqui é ${artigo(profile)}${comoChama} da ${empresa} de ${cidade}. ${motiveLine(input.market)}`,
    pergunta,
    `Queria te apresentar numa conversa de ${duracao} minutos — sem compromisso de produto. Como está sua agenda?`,
  ].join("\n");
}

export function helloGlance(beat: string): string {
  const match = beat.match(
    /^Olá\s+([^,]+),\s+aqui é\s+(?:[oae]\s+)?(.+?)\s+da\s+(.+?)\s+de\s+([^.]+)/i,
  );
  if (match) {
    return `Olá ${match[1].trim()} · ${match[3].trim()} · ${match[4].trim()}`;
  }
  const short = beat.match(/^Olá\s+([^,.]+)/i);
  return short ? `Olá ${short[1].trim()}` : "Olá";
}

export function ctaGlance(beat: string, duracao: number): string {
  const mins = beat.match(/(\d+)\s*minutos?/i);
  return `${mins?.[1] ?? duracao} min · agenda?`;
}

export const ANATOMY_BEATS = [
  "Apresentação e motivo",
  "Espaço para consideração",
  "Fechamento",
] as const;

export type AnatomyBeats = [string, string, string];

export function anatomyBeatsFromScript(script: string): AnatomyBeats {
  const lines = script.split(/\r?\n/);
  if (lines.length === ANATOMY_BEATS.length) {
    return [lines[0], lines[1], lines[2]];
  }
  const packed = lines.map((line) => line.trim()).filter(Boolean);
  const third =
    packed.length > ANATOMY_BEATS.length
      ? packed.slice(2).join(" ")
      : (packed[2] ?? "");
  return [packed[0] ?? "", packed[1] ?? "", third];
}

export function scriptFromAnatomyBeats(beats: readonly string[]): string {
  return ANATOMY_BEATS.map((_, i) => beats[i] ?? "").join("\n");
}

export function copyAnatomyScript(script: string): string {
  return anatomyBeatsFromScript(script)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function splitAnatomyBeats(script: string): string[] | null {
  const beats = anatomyBeatsFromScript(script);
  if (beats.some((line) => !line.trim())) return null;
  return beats;
}
