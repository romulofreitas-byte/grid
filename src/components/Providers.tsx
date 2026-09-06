"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TelemetryBar } from "@/components/DataPullIndicator";
import { FocusBadge } from "@/components/FocusBadge";
import { FocusModeProvider } from "@/components/FocusModeProvider";
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
        <FocusModeProvider>
          <ShellToneRoot />
          <TelemetryBar />
          {children}
          <FocusBadge />
        </FocusModeProvider>
      </PaywallProvider>
    </QueryClientProvider>
  );
}
