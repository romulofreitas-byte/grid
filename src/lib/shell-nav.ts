import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Cable,
  CircleHelp,
  Columns3,
  Flag,
  List,
  LogOut,
  Search,
  Target,
  UserRound,
  Wallet,
} from "lucide-react";
import { integracoesHref } from "@/lib/back";

export type ShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  tour?: string;
};

export type ShellNavChild = {
  href: string;
  label: string;
  kind?: "voip" | "dialer";
};

export type ShellFooterItem = {
  href?: string;
  label: string;
  icon: LucideIcon;
  children?: readonly ShellNavChild[];
  action?: "logout";
  billingFrom?: boolean;
};

export const SHELL_WORK_NAV: readonly ShellNavItem[] = [
  { href: "/painel", label: "Painel", icon: BarChart3 },
  { href: "/metas", label: "Meta", icon: Target },
  { href: "/largada", label: "Nova lista", icon: Flag, tour: "nova-lista" },
  { href: "/empresas", label: "Empresas", icon: Search },
  { href: "/listas", label: "Listas", icon: List },
  { href: "/crm", label: "CRM", icon: Columns3 },
];

export const SHELL_FOOTER_NAV: readonly ShellFooterItem[] = [
  { href: "/conta", label: "Conta", icon: UserRound },
  {
    label: "Integrações",
    icon: Cable,
    children: [
      { href: integracoesHref("voip"), label: "VoIP", kind: "voip" },
      { href: integracoesHref("dialer"), label: "Discador", kind: "dialer" },
      { href: "/importacoes", label: "Importações" },
      { href: "/automacoes", label: "Automações" },
    ],
  },
  { href: "/planos", label: "Planos", icon: Wallet, billingFrom: true },
  { href: "/duvidas", label: "Dúvidas", icon: CircleHelp },
  { label: "Sair", icon: LogOut, action: "logout" },
];

export function isShellNavActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isShellChildActive(
  child: ShellNavChild,
  pathname: string,
  _searchKind: string | null,
): boolean {
  const path = child.href.split("?")[0] ?? child.href;
  return isShellNavActive(path, pathname);
}

export function isShellFooterActive(
  item: ShellFooterItem,
  pathname: string,
  _searchKind: string | null,
): boolean {
  if (item.action === "logout" || !item.href) return false;
  return isShellNavActive(item.href, pathname);
}

export function isShellFooterGroupActive(
  item: ShellFooterItem,
  pathname: string,
  searchKind: string | null,
): boolean {
  return Boolean(
    item.children?.some((child) =>
      isShellChildActive(child, pathname, searchKind),
    ),
  );
}

export function footerItemKey(item: ShellFooterItem): string {
  if (item.action === "logout") return "logout";
  return item.href ?? item.label;
}

export function isFooterAccordion(item: ShellFooterItem): boolean {
  return Boolean(item.children?.length) && !item.href && item.action !== "logout";
}
