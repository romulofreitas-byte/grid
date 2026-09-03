/** Paid plans qualify with any credits. Treino livre only spends plan credits. */

export function canSpendQualifyCredits(balance: {
  enrichAllowed: boolean;
  trialExpired?: boolean;
  plan: number;
}): boolean {
  if (balance.trialExpired && !balance.enrichAllowed) return false;
  if (balance.enrichAllowed) return true;
  return balance.plan > 0;
}

export function qualifyCreditPool(balance: {
  enrichAllowed: boolean;
  plan: number;
  total: number;
}): number {
  if (balance.enrichAllowed) return balance.total;
  return Math.max(0, balance.plan);
}
