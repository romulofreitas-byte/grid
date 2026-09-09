import { AppShell } from "@/components/AppShell";
import { BACK } from "@/lib/back";
import { COPY } from "@/lib/copy";

export default function ImportacoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell fill wide lockHeight title={COPY.importacoesTitle} back={BACK.integracoes}>
      {children}
    </AppShell>
  );
}
