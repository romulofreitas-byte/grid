import { AppShell } from "@/components/AppShell";
import { COPY } from "@/lib/copy";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return <AppShell title={COPY.painelTitle}>{children}</AppShell>;
}
