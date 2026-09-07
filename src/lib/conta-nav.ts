import type { LucideIcon } from "lucide-react";
import {
  Cable,
  CircleHelp,
  KeyRound,
  LayoutDashboard,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export type ContaNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
};

export const CONTA_NAV: readonly ContaNavItem[] = [
  { href: "/conta", label: "Resumo", icon: LayoutDashboard },
  { href: "/conta/perfil", label: "Perfil", icon: UserRound },
  { href: "/conta/acesso", label: "Acesso", icon: KeyRound },
  { href: "/conta/plano", label: "Plano", icon: Wallet },
  { href: "/conta/conexoes", label: "Conexões", icon: Cable },
  { href: "/conta/ajuda", label: "Ajuda", icon: CircleHelp },
  { href: "/conta/equipe", label: "Equipe", icon: Users },
];

export function isContaNavActive(href: string, pathname: string): boolean {
  if (href === "/conta") return pathname === "/conta";
  return pathname === href || pathname.startsWith(`${href}/`);
}
