import type { Profile, Tratamento } from "@/lib/types";

export const DEFAULT_MEETING_MINUTES = 20;
export const DEFAULT_CALL_GOAL = 20;
export const MAX_CALL_GOAL = 500;
export const CALL_GOAL_OPTIONS = [5, 10, 20, 30] as const;

export type CatalogOption = { id: string; label: string };
export type CatalogGroup = { id: string; label: string | null; options: CatalogOption[] };

export const MARKET_OPTIONS: readonly CatalogOption[] = [
  { id: "marketing", label: "Marketing" },
  { id: "seguros", label: "Seguros" },
  { id: "plano_saude", label: "Plano de saúde" },
  { id: "consorcio", label: "Consórcios" },
  { id: "assessoria_investimentos", label: "Assessoria de investimentos" },
  { id: "contabilidade", label: "Contabilidade" },
  { id: "b2b_servicos", label: "B2B serviços" },
  { id: "imobiliario", label: "Imobiliário" },
  { id: "software", label: "Software" },
  { id: "educacao", label: "Educação" },
  { id: "energia_solar", label: "Energia solar" },
  { id: "outro", label: "Outro" },
];

export const CARGO_GROUPS: readonly CatalogGroup[] = [
  {
    id: "prospeccao",
    label: "Prospecção",
    options: [
      { id: "sdr", label: "SDR" },
      { id: "bdr", label: "BDR" },
      { id: "closer", label: "Closer" },
      { id: "hunter", label: "Hunter" },
      { id: "inside_sales", label: "Inside sales" },
      { id: "account_executive", label: "Account executive" },
    ],
  },
  {
    id: "lideranca",
    label: "Liderança",
    options: [
      { id: "diretor_comercial", label: "Diretor comercial" },
      { id: "gestor_comercial", label: "Gestor comercial" },
      { id: "socio", label: "Sócio" },
    ],
  },
  {
    id: "campo",
    label: "Campo",
    options: [
      { id: "vendedor", label: "Vendedor" },
      { id: "representante", label: "Representante comercial" },
      { id: "corretor", label: "Corretor" },
    ],
  },
  {
    id: "especialistas",
    label: "Especialistas",
    options: [
      { id: "assessor_investimentos", label: "Assessor de investimentos" },
      { id: "consorcio", label: "Consórcio" },
      { id: "franquia", label: "Franquia" },
    ],
  },
  {
    id: "outro",
    label: null,
    options: [{ id: "outro", label: "Outro" }],
  },
];

export const CARGO_OPTIONS: readonly CatalogOption[] = CARGO_GROUPS.flatMap(
  (group) => group.options,
);

export const MARKET_GROUPS: readonly CatalogGroup[] = [
  { id: "mercado", label: null, options: [...MARKET_OPTIONS] },
];

export type CargoId = (typeof CARGO_OPTIONS)[number]["id"];
export type MarketId = (typeof MARKET_OPTIONS)[number]["id"];

const CARGO_ALIASES: Record<string, string> = {
  diretor: "diretor_comercial",
  gestor: "gestor_comercial",
};

export const PROFILE_WRITABLE_KEYS = [
  "nome",
  "especialidade",
  "cargo",
  "area",
  "empresa_usuario",
  "cidade_usuario",
  "documento",
  "documento_tipo",
  "foto_url",
  "como_chama",
  "tratamento",
  "promessa",
  "duracao_reuniao",
  "meta_ligacoes_dia",
  "onboarding_completed_at",
] as const satisfies ReadonlyArray<keyof Profile>;

const TRATAMENTOS: Tratamento[] = ["o", "a", "e"];

function blankToNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function isTratamento(value: unknown): value is Tratamento {
  return typeof value === "string" && TRATAMENTOS.includes(value as Tratamento);
}

function catalogChoice(
  value: string | null | undefined,
  options: readonly CatalogOption[],
  aliases: Record<string, string> = {},
): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const canonical = aliases[trimmed] ?? trimmed;
  if (options.some((option) => option.id === canonical)) return canonical;
  const byLabel = options.find(
    (option) =>
      option.id !== "outro" &&
      option.label.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byLabel) return byLabel.id;
  return "outro";
}

function catalogLabel(
  value: string | null | undefined,
  options: readonly CatalogOption[],
  aliases: Record<string, string> = {},
): string {
  const choice = catalogChoice(value, options, aliases);
  if (!choice) return "";
  if (choice === "outro") {
    const trimmed = value?.trim() ?? "";
    return trimmed && trimmed !== "outro" ? trimmed : "Outro";
  }
  return options.find((option) => option.id === choice)?.label ?? value?.trim() ?? "";
}

export function isCargoId(value: unknown): value is CargoId {
  return CARGO_OPTIONS.some((option) => option.id === value);
}

export function isMarketId(value: unknown): value is MarketId {
  return MARKET_OPTIONS.some((option) => option.id === value);
}

export function cargoChoice(cargo: string | null | undefined): CargoId | null {
  return catalogChoice(cargo, CARGO_OPTIONS, CARGO_ALIASES) as CargoId | null;
}

export function cargoLabel(cargo: string | null | undefined): string {
  return catalogLabel(cargo, CARGO_OPTIONS, CARGO_ALIASES);
}

export function marketChoice(
  especialidade: string | null | undefined,
): MarketId | null {
  return catalogChoice(especialidade, MARKET_OPTIONS) as MarketId | null;
}

export function marketLabel(especialidade: string | null | undefined): string {
  return catalogLabel(especialidade, MARKET_OPTIONS);
}

export function setupEcho(profile: {
  como_chama?: string | null;
  nome?: string | null;
  especialidade?: string | null;
  cargo?: string | null;
}): string {
  return [
    displayName(profile),
    cargoLabel(profile.cargo),
    marketLabel(profile.especialidade),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function clampCallGoal(value: unknown): number {
  const n = Number(value);
  if (CALL_GOAL_OPTIONS.includes(n as (typeof CALL_GOAL_OPTIONS)[number])) {
    return n;
  }
  if (Number.isFinite(n) && n >= 1 && n <= MAX_CALL_GOAL) return Math.round(n);
  return DEFAULT_CALL_GOAL;
}

export function clampMeetingMinutes(value: unknown): number {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 5 && n <= 120) return Math.round(n);
  return DEFAULT_MEETING_MINUTES;
}

export function sanitizeProfilePatch(body: unknown): Partial<Profile> {
  if (!body || typeof body !== "object") return {};
  const raw = body as Record<string, unknown>;
  const patch: Partial<Profile> = {};
  for (const key of PROFILE_WRITABLE_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (key === "tratamento") {
      patch.tratamento = isTratamento(value) ? value : null;
    } else if (key === "duracao_reuniao") {
      patch.duracao_reuniao = clampMeetingMinutes(value);
    } else if (key === "meta_ligacoes_dia") {
      patch.meta_ligacoes_dia = clampCallGoal(value);
    } else if (key === "documento_tipo") {
      patch.documento_tipo = value === "cpf" || value === "cnpj" ? value : null;
    } else if (key === "onboarding_completed_at") {
      patch.onboarding_completed_at =
        value == null ? null : String(value);
    } else if (key === "cargo") {
      const text = blankToNull(value);
      patch.cargo = text ? text.slice(0, 80) : null;
    } else {
      (patch as Record<string, unknown>)[key] = blankToNull(value);
    }
  }
  return patch;
}

function filled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasCatalogValue(value: string | null | undefined): boolean {
  const text = value?.trim();
  return Boolean(text) && text !== "outro";
}

export type PresentationIdentity = Pick<
  Profile,
  "como_chama" | "nome" | "empresa_usuario" | "cidade_usuario"
>;

export type ScriptIdentity = PresentationIdentity &
  Pick<Profile, "promessa">;

export type SetupIdentity = Pick<
  Profile,
  "como_chama" | "nome" | "especialidade" | "cargo"
>;

export function hasPresentationIdentity(
  profile: PresentationIdentity,
): boolean {
  const name = filled(profile.como_chama) || filled(profile.nome);
  return (
    Boolean(name) &&
    filled(profile.empresa_usuario) &&
    filled(profile.cidade_usuario)
  );
}

export function hasScriptIdentity(profile: ScriptIdentity): boolean {
  return hasPresentationIdentity(profile) && filled(profile.promessa);
}

export function hasSetupIdentity(profile: SetupIdentity): boolean {
  const name = filled(profile.como_chama) || filled(profile.nome);
  return (
    Boolean(name) &&
    hasCatalogValue(profile.especialidade) &&
    hasCatalogValue(profile.cargo)
  );
}

export function needsHelmetSetup(profile: Profile): boolean {
  return !profile.onboarding_completed_at;
}

export function profileIdentityStatus(profile: Profile): string {
  const gaps: string[] = [];
  if (!(filled(profile.como_chama) || filled(profile.nome))) {
    gaps.push("como se chama");
  }
  if (!hasCatalogValue(profile.especialidade)) gaps.push("mercado");
  if (!hasCatalogValue(profile.cargo)) gaps.push("cargo");
  if (gaps.length === 0) return "Nome, mercado e cargo preenchidos.";
  if (gaps.length === 1) return `Falta ${gaps[0]}.`;
  if (gaps.length === 2) return `Falta ${gaps[0]} e ${gaps[1]}.`;
  return `Falta ${gaps[0]}, ${gaps[1]} e ${gaps[2]}.`;
}

/** 0–100. Four equal slots: name, market, role, photo. */
export function profileReadiness(profile: Profile): number {
  const slots = [
    filled(profile.como_chama) || filled(profile.nome),
    hasCatalogValue(profile.especialidade),
    hasCatalogValue(profile.cargo),
    filled(profile.foto_url),
  ];
  return Math.round((slots.filter(Boolean).length / slots.length) * 100);
}

export function displayName(profile: {
  como_chama?: string | null;
  nome?: string | null;
}): string {
  return profile.como_chama?.trim() || profile.nome?.trim() || "Piloto";
}

export function initials(profile: {
  como_chama?: string | null;
  nome?: string | null;
}): string {
  const source = displayName(profile);
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
