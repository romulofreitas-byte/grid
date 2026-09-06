import { AppShell } from "@/components/AppShell";

export default function BoxLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell title="Ligar" fill wide lockHeight>
      {children}
    </AppShell>
  );
}
