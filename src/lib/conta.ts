import { getCatalogItem } from "@/lib/billing/catalog";
import type { BillingMe } from "@/lib/billing/types";
import type { Profile } from "@/lib/types";

export const CONTA_FIELD_CLASS =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40";

export type AccountProfile = Profile & {
  email?: string | null;
  isAdmin?: boolean;
};

export function formatAccountDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

export function accountPeriodEnd(billing: BillingMe | undefined): string | null {
  return billing?.subscription?.currentPeriodEnd ?? billing?.balance.periodEndsAt ?? null;
}

export function accountPlanName(
  billing: BillingMe | undefined,
  profile: Pick<Profile, "plano"> | undefined,
): string {
  const sku = billing?.balance.plano ?? profile?.plano ?? "";
  return getCatalogItem(sku)?.nome ?? sku;
}

export function accountCredits(billing: BillingMe | undefined, profile: Profile | undefined): number {
  return billing?.balance.total ?? profile?.creditos ?? 0;
}
