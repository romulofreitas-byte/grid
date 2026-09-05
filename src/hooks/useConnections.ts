import { useQuery } from "@tanstack/react-query";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";

export const CONNECTIONS_QUERY_KEY = ["integrations-connections"] as const;

export function useConnections() {
  return useQuery({
    queryKey: CONNECTIONS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/integrations/connections");
      if (!res.ok) throw new Error("Não foi possível carregar as conexões");
      const json = (await res.json()) as { connections: IntegrationConnectionPublic[] };
      return json.connections;
    },
  });
}
