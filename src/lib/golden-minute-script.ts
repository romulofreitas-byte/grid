import { DEFAULT_MEETING_MINUTES } from "@/lib/pilot-profile";
import type { MarketBrief, Profile, Tratamento } from "@/lib/types";

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
  market?: Pick<MarketBrief, "slug" | "perguntaConsideracao"> | null;
};

export const CONSIDERATION_LINE = "Como vocês resolvem isso hoje?";

export const ANATOMY_SLOT_IDS = [
  "artigo",
  "nome",
  "empresa",
  "cidade",
  "promessa",
  "consideracao",
  "duracao",
] as const;

export type AnatomySlotId = (typeof ANATOMY_SLOT_IDS)[number];

export type AnatomySlot = {
  id: AnatomySlotId;
  label: string;
  value: string | null;
  source: "profile" | "lead";
  fieldId: string;
};

const SLOT_META: Record<
  AnatomySlotId,
  { label: string; fieldId: string; source: AnatomySlot["source"] }
> = {
  artigo: { label: "artigo", fieldId: "tratamento", source: "profile" },
  nome: { label: "nome", fieldId: "como_chama", source: "profile" },
  empresa: { label: "empresa", fieldId: "empresa_usuario", source: "profile" },
  cidade: { label: "cidade", fieldId: "cidade_usuario", source: "profile" },
  promessa: { label: "promessa", fieldId: "promessa", source: "profile" },
  consideracao: { label: "consideração", fieldId: "promessa", source: "lead" },
  duracao: { label: "minutos", fieldId: "duracao_reuniao", source: "profile" },
};

function filled(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function firstName(nome: string | null | undefined): string | null {
  const first = nome?.trim().split(/\s+/)[0];
  return first || null;
}

function slot(value: string | null | undefined, fallback: string): string {
  return filled(value) ?? fallback;
}

function artigo(profile: ScriptProfile): string {
  if (profile.tratamento === "a") return "a ";
  if (profile.tratamento === "e") return "e ";
  return "o ";
}

function artigoValue(tratamento: Tratamento | null | undefined): string | null {
  if (tratamento === "a" || tratamento === "e" || tratamento === "o") {
    return tratamento;
  }
  return null;
}

function endSentence(text: string): string {
  const trimmed = text.trim().replace(/\.*$/, "");
  return trimmed ? `${trimmed}.` : "";
}

/** First spoken sentence. Drops the subjective clause after the first stop. */
export function spokenLine(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const stop = trimmed.search(/[.!?]/);
  const first = (stop >= 0 ? trimmed.slice(0, stop + 1) : trimmed).trim();
  if (/[?!]$/.test(first)) return first;
  return endSentence(first);
}

function isRealMarket(
  market: AnatomyInput["market"],
): market is NonNullable<AnatomyInput["market"]> {
  const slug = market?.slug?.trim();
  return Boolean(slug && slug !== "generico");
}

function considerationLine(input: AnatomyInput = {}): string {
  if (!isRealMarket(input.market)) return CONSIDERATION_LINE;
  const spoken = spokenLine(input.market.perguntaConsideracao);
  if (!spoken) return CONSIDERATION_LINE;
  if (/[?]$/.test(spoken)) return spoken;
  return `${spoken.replace(/\.$/, "")}?`;
}

function promiseLine(promessa: string): string {
  return `A gente entrega ${promessa.trim().replace(/\.*$/, "")}.`;
}

export function anatomyAssembly(profile: ScriptProfile): Record<AnatomySlotId, AnatomySlot> {
  const nome = filled(profile.como_chama) ?? firstName(profile.nome);
  const promessa = filled(profile.promessa);
  const duracao = profile.duracao_reuniao || DEFAULT_MEETING_MINUTES;

  const values: Record<AnatomySlotId, string | null> = {
    artigo: artigoValue(profile.tratamento),
    nome,
    empresa: filled(profile.empresa_usuario),
    cidade: filled(profile.cidade_usuario),
    promessa,
    consideracao: promessa ? CONSIDERATION_LINE : null,
    duracao: String(duracao),
  };

  return Object.fromEntries(
    ANATOMY_SLOT_IDS.map((id) => [
      id,
      {
        id,
        label: SLOT_META[id].label,
        value: values[id],
        source: SLOT_META[id].source,
        fieldId: SLOT_META[id].fieldId,
      },
    ]),
  ) as Record<AnatomySlotId, AnatomySlot>;
}

export function buildOpeningScript(
  profile: ScriptProfile,
  input: AnatomyInput = {},
): string {
  const decisor = firstName(input.decisorNome) ?? "aí";
  const comoChama = slot(
    profile.como_chama,
    slot(firstName(profile.nome), "Piloto"),
  );
  const empresa = slot(profile.empresa_usuario, "empresa");
  const cidade = slot(profile.cidade_usuario, "cidade");
  const duracao = profile.duracao_reuniao || DEFAULT_MEETING_MINUTES;
  const promessa = filled(profile.promessa);

  const hello = `Olá ${decisor}, aqui é ${artigo(profile)}${comoChama} da ${empresa} de ${cidade}.`;
  const beat1 = promessa ? `${hello} ${promiseLine(promessa)}` : hello;

  return [
    beat1,
    considerationLine(input),
    `Queria te mostrar isso em ${duracao} minutos. Como está sua agenda?`,
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
