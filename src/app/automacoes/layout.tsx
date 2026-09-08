import { AppShell } from "@/components/AppShell";
import { BACK } from "@/lib/back";
import { COPY } from "@/lib/copy";

export default function AutomacoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell fill wide lockHeight title={COPY.automacoesTitle} back={BACK.integracoes}>
      {children}
    </AppShell>
  );
}
