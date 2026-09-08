import { AppShell } from "@/components/AppShell";
import { BACK } from "@/lib/back";
import { COPY } from "@/lib/copy";

export default function IntegracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell title={COPY.integracoesTitle} back={BACK.painel}>
      {children}
    </AppShell>
  );
}
