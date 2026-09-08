import { AppShell } from "@/components/AppShell";
import { COPY } from "@/lib/copy";

export default function MetasLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell fill wide lockHeight title={COPY.calculadoraTitle}>
      {children}
    </AppShell>
  );
}
