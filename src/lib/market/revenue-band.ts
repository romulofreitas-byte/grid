/**
 * Display-only revenue band estimate from Receita porte (+ optional capital).
 * Never claim this is official faturamento — label confidence and basis.
 */

export type RevenueBandId =
  | "ate_360k"
  | "360k_4_8m"
  | "acima_4_8m"
  | "indefinido";

export type RevenueBandEstimate = {
  bandId: RevenueBandId;
  /** Short label for badges / headers */
  label: string;
  /** Simples vs Lucro hint — not a tax status fact */
  regimeHint: string;
  confidence: "baixa" | "media";
  /** Honest disclaimer for UI */
  basis: string;
};

const BASIS =
  "Estimativa a partir do porte (e capital, se houver) — não é faturamento oficial da Receita.";

export function estimateRevenueBand(input: {
  porte: string | null | undefined;
  capitalSocial?: number | null;
}): RevenueBandEstimate | null {
  const porte = input.porte?.trim() || null;
  if (!porte) return null;

  const capital =
    input.capitalSocial != null && Number.isFinite(input.capitalSocial)
      ? input.capitalSocial
      : null;

  if (porte === "01") {
    const highCapital = capital != null && capital >= 500_000;
    return {
      bandId: "ate_360k",
      label: "Até ~R$ 360 mil/ano",
      regimeHint: "Faixa típica de ME no Simples",
      confidence: highCapital ? "baixa" : "media",
      basis: highCapital
        ? `${BASIS} Capital social elevado para ME — trate com cautela.`
        : BASIS,
    };
  }

  if (porte === "03") {
    return {
      bandId: "360k_4_8m",
      label: "~R$ 360 mil–4,8 mi/ano",
      regimeHint: "Faixa típica de EPP no Simples",
      confidence: "media",
      basis: BASIS,
    };
  }

  if (porte === "05") {
    const modestCapital = capital != null && capital > 0 && capital < 300_000;
    return {
      bandId: "acima_4_8m",
      label: "Acima de ~R$ 4,8 mi/ano (ou fora do Simples)",
      regimeHint: "Mais comum em Lucro Presumido / Real",
      confidence: modestCapital ? "baixa" : "baixa",
      basis: modestCapital
        ? `${BASIS} Porte “Demais” com capital modesto — pode ser exceção.`
        : BASIS,
    };
  }

  return {
    bandId: "indefinido",
    label: "Faixa não classificada",
    regimeHint: "Porte sem mapeamento Simples/Lucro",
    confidence: "baixa",
    basis: BASIS,
  };
}
