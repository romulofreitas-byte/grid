/** Resolve an originate_call job: phone is enough; CNPJ is optional. */

export function resolveOriginateTarget(
  payload: Record<string, unknown> | null | undefined,
): {
  cnpj: string;
  dealId: string | null;
  rawTo: string;
  skipLeadRecord: boolean;
} {
  const raw = payload ?? {};
  const digits = String(raw.cnpj ?? "").replace(/\D/g, "");
  const cnpj = digits.length === 14 ? digits : "";
  const dealId =
    typeof raw.dealId === "string" && raw.dealId.trim()
      ? raw.dealId.trim()
      : null;
  const rawTo = typeof raw.to === "string" ? raw.to.trim() : "";
  return {
    cnpj,
    dealId,
    rawTo,
    skipLeadRecord: Boolean(dealId) || !cnpj,
  };
}
