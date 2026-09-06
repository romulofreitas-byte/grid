"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { TelemetryBar } from "@/components/DataPullIndicator";
import { PaywallProvider } from "@/components/PaywallDialog";
import { ShellToneRoot } from "@/components/ShellToneRoot";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <PaywallProvider>
        <Suspense fallback={null}>
          <ShellToneRoot />
        </Suspense>
        <TelemetryBar />
        {children}
      </PaywallProvider>
    </QueryClientProvider>
  );
}
