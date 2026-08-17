"use client";

import { useQuery } from "@tanstack/react-query";
import type { BillingMe } from "@/lib/billing/types";

export const BILLING_ME_QUERY_KEY = ["billing-me"] as const;

export function useBillingMe() {
  return useQuery({
    queryKey: BILLING_ME_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/billing/me");
      if (!res.ok) throw new Error("Não foi possível carregar a conta");
      return (await res.json()) as BillingMe;
    },
  });
}
