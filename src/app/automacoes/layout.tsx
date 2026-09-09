import type { ReactNode } from "react";
import { AutomacoesAppShell } from "./AutomacoesAppShell";

export default function AutomacoesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AutomacoesAppShell>{children}</AutomacoesAppShell>;
}
