import type { Profile, Tratamento } from "@/lib/types";

export const DEFAULT_MEETING_MINUTES = 20;
export const DEFAULT_CALL_GOAL = 20;
export const MAX_CALL_GOAL = 500;
export const CALL_GOAL_OPTIONS = [5, 10, 20, 30] as const;

export const PROFILE_WRITABLE_KEYS = [
  "nome",
  "especialidade",
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
    } else {
      (patch as Record<string, unknown>)[key] = blankToNull(value);
    }
  }
  return patch;
}

function filled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export type PresentationIdentity = Pick<
  Profile,
  "como_chama" | "nome" | "empresa_usuario" | "cidade_usuario"
>;

export type ScriptIdentity = PresentationIdentity &
  Pick<Profile, "promessa">;

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

export function needsHelmetSetup(profile: Profile): boolean {
  return !profile.onboarding_completed_at;
}

/** 0–100. Five equal slots: name, company, city, promise, photo. */
export function profileReadiness(profile: Profile): number {
  const slots = [
    filled(profile.como_chama) || filled(profile.nome),
    filled(profile.empresa_usuario),
    filled(profile.cidade_usuario),
    filled(profile.promessa),
    filled(profile.foto_url),
  ];
  return Math.round((slots.filter(Boolean).length / slots.length) * 100);
}

export function displayName(profile: Pick<Profile, "como_chama" | "nome">): string {
  return profile.como_chama?.trim() || profile.nome?.trim() || "Piloto";
}

export function initials(profile: Pick<Profile, "como_chama" | "nome">): string {
  const source = displayName(profile);
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
