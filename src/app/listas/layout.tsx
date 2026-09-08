import { AppShell } from "@/components/AppShell";
import { BACK } from "@/lib/back";

export default function ListasLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell fill wide lockHeight title="Listas" back={BACK.painel}>
      {children}
    </AppShell>
  );
}
