import { resolvePresetCnaes } from "@/lib/niches";
import { normalizePipelineNome } from "@/lib/crm/bridge";
import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import type { NichePreset, NichePresetCnae, RefCnae } from "@/lib/types";

export function normalizeCnaeCode(cnae: string | null | undefined): string {
  return (cnae ?? "").replace(/\D/g, "").padStart(7, "0").slice(-7);
}

export function matchPresetForCnae(
  cnae: string | null | undefined,
  presets: NichePreset[],
  curated: NichePresetCnae[],
  refCnaes: RefCnae[],
): NichePreset | null {
  const code = normalizeCnaeCode(cnae);
  if (!code || code === "0000000") return null;
  const segments = presets
    .filter((p) => p.parent_id)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  for (const preset of segments) {
    const codes = resolvePresetCnaes(preset, curated, refCnaes).map(normalizeCnaeCode);
    if (codes.includes(code)) return preset;
  }
  const roots = presets
    .filter((p) => !p.parent_id)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  for (const preset of roots) {
    const codes = resolvePresetCnaes(preset, curated, refCnaes).map(normalizeCnaeCode);
    if (codes.includes(code)) return preset;
  }
  return null;
}

export function pipelineNomeForCompany(input: {
  presetNome?: string | null;
  cnaeDescricao?: string | null;
}): string {
  const preset = input.presetNome?.trim();
  if (preset) return normalizePipelineNome(preset);
  const cnae = input.cnaeDescricao?.trim();
  if (cnae && cnae.toUpperCase() !== "NÃO ENCONTRADO") {
    return normalizePipelineNome(cnae);
  }
  return DEFAULT_PIPELINE_NAME;
}
