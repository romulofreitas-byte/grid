import { AppShell } from "@/components/AppShell";
import { COPY } from "@/lib/copy";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell title={COPY.crmNav} fill wide lockHeight>
      {children}
    </AppShell>
  );
}
