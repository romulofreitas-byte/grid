import { useQuery } from "@tanstack/react-query";
import type { AccountProfile } from "@/lib/conta";

export const ACCOUNT_PROFILE_QUERY_KEY = ["profile"] as const;

export function useAccountProfile() {
  return useQuery({
    queryKey: ACCOUNT_PROFILE_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Não foi possível carregar o perfil");
      return (await res.json()) as AccountProfile;
    },
  });
}
