export function scoreBand(score: number): "POLE" | "FRENTE" | "MEIO" | "FUNDO" {
  if (score >= 85) return "POLE";
  if (score >= 70) return "FRENTE";
  if (score >= 50) return "MEIO";
  return "FUNDO";
}
