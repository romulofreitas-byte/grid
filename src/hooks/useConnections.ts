import { useQuery } from "@tanstack/react-query";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";

export const CONNECTIONS_QUERY_KEY = ["integration-connections"] as const;

export function useConnections(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: CONNECTIONS_QUERY_KEY,
    enabled: opts?.enabled ?? true,
    queryFn: async () => {
      const res = await fetch("/api/integrations/connections");
      if (!res.ok) throw new Error("Não foi possível carregar as conexões");
      const json = (await res.json()) as { connections: IntegrationConnectionPublic[] };
      return json.connections;
    },
  });
}
