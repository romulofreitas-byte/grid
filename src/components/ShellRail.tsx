"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { ChevronDown, PanelLeft, PanelLeftClose } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { COPY } from "@/lib/copy";
import { logoutPilot } from "@/lib/auth/logout-client";
import { pathWithSearch, planosHref } from "@/lib/billing/href";
import {
  footerItemKey,
  isFooterAccordion,
  isShellChildActive,
  isShellFooterActive,
  isShellFooterGroupActive,
  isShellNavActive,
  showsOpeningNav,
  SHELL_FOOTER_NAV,
  SHELL_WORK_NAV,
  type ShellFooterItem,
  type ShellNavItem,
} from "@/lib/shell-nav";
import {
  readShellRailExpanded,
  readShellRailOpen,
  shellRailWidthClass,
  writeShellRailExpanded,
  writeShellRailOpen,
} from "@/lib/shell-rail";
import { cn } from "@/lib/utils";

function stopToggle(event: MouseEvent) {
  event.stopPropagation();
}

function RailLabel({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "overflow-hidden whitespace-nowrap text-[11px] leading-tight transition-[opacity,max-width] duration-200 ease-out",
        open ? "max-w-[9rem] opacity-100" : "max-w-0 opacity-0",
      )}
    >
      {children}
    </span>
  );
}

function ActiveTick() {
  return (
    <>
      <span className="absolute inset-y-1.5 left-1 w-0.5 rounded-full bg-podium-yellow" />
      <span className="absolute inset-0 -z-10 rounded-md bg-podium-yellow/15" />
    </>
  );
}

function itemRowClass(open: boolean, active: boolean) {
  return cn(
    "relative flex items-center gap-2.5 rounded-md py-2",
    open ? "px-2.5" : "justify-center px-2",
    active
      ? "text-podium-yellow"
      : "text-podium-gray group-hover:text-podium-white",
  );
}

function WorkFace({
  item,
  open,
  active,
  pending,
}: {
  item: ShellNavItem;
  open: boolean;
  active: boolean;
  pending: boolean;
}) {
  const opening = pending && showsOpeningNav(item.href);
  const Icon = item.icon;
  return (
    <>
      {active ? <ActiveTick /> : null}
      <Icon className={cn("h-4 w-4 shrink-0", pending && "animate-pulse")} />
      <RailLabel open={open}>{opening ? COPY.crmOpeningNav : item.label}</RailLabel>
    </>
  );
}

export function useShellRailOpen() {
  const [open, setOpen] = useState(readShellRailOpen);
  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      writeShellRailOpen(next);
      return next;
    });
  }
  return { open, toggle };
}

function WorkLink({
  item,
  open,
}: {
  item: ShellNavItem;
  open: boolean;
}) {
  const pathname = usePathname();
  const { pending } = useLinkStatus();
  const active = isShellNavActive(item.href, pathname) || pending;

  return (
    <span className={itemRowClass(open, active)}>
      <WorkFace item={item} open={open} active={active} pending={pending} />
    </span>
  );
}

function FooterLinkFace({
  item,
  open,
  active,
  expanded,
}: {
  item: ShellFooterItem;
  open: boolean;
  active: boolean;
  expanded?: boolean;
}) {
  const Icon = item.icon;
  return (
    <>
      {active ? <ActiveTick /> : null}
      <Icon className="h-4 w-4 shrink-0" />
      <RailLabel open={open}>{item.label}</RailLabel>
      {open && item.children?.length ? (
        <ChevronDown
          className={cn(
            "ml-auto h-3 w-3 shrink-0 text-podium-muted transition-transform",
            expanded && "rotate-180",
          )}
        />
      ) : null}
    </>
  );
}

function FooterChild({
  child,
  pathname,
  searchKind,
  itemKind,
}: {
  child: { href: string; label: string; kind?: "voip" | "dialer" };
  pathname: string;
  searchKind: string | null;
  itemKind: "link" | "static";
}) {
  const childActive = isShellChildActive(child, pathname, searchKind);
  const childClass = cn(
    "relative block rounded-md px-2 py-1.5 text-[11px]",
    childActive
      ? "text-podium-yellow"
      : "text-podium-muted hover:text-podium-white",
  );
  const face = (
    <>
      {childActive ? <ActiveTick /> : null}
      {child.label}
    </>
  );
  if (itemKind === "static") {
    return (
      <span className={childClass} onClick={stopToggle}>
        {face}
      </span>
    );
  }
  return (
    <Link href={child.href} className={childClass} onClick={stopToggle}>
      {face}
    </Link>
  );
}

export function ShellRail({
  open,
  onToggle,
  itemKind = "link",
  activeId = null,
  homeHref = "/painel",
}: {
  open: boolean;
  onToggle?: () => void;
  itemKind?: "link" | "static";
  activeId?: string | null;
  homeHref?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKind = searchParams.get("kind");
  const from = pathWithSearch(pathname, searchParams.toString());
  const [motion, setMotion] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(() =>
    open ? readShellRailExpanded() : null,
  );

  useEffect(() => {
    const id = window.setTimeout(() => setMotion(true), 40);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (open) return;
    setExpandedKey(null);
    writeShellRailExpanded(null);
  }, [open]);

  function setRailExpanded(next: string | null) {
    setExpandedKey(next);
    writeShellRailExpanded(next);
  }

  async function logout() {
    if (leaving) return;
    setLeaving(true);
    await logoutPilot();
  }

  const railBorder = "border-white/10";
  const sectionLabel =
    "text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-muted";

  return (
    <aside
      className={cn(
        "hidden h-full min-h-0 shrink-0 flex-col border-r border-white/10 bg-podium-navy/90 backdrop-blur-xl md:flex",
        motion &&
          "transition-[width] duration-300 ease-out motion-reduce:transition-none",
        shellRailWidthClass(open),
      )}
      onClick={onToggle}
    >
      <div className={cn("flex h-14 shrink-0 items-center", open ? "px-3" : "justify-center")}>
        <Link
          href={homeHref}
          className="flex min-w-0 items-center"
          aria-label="GRID"
          onClick={stopToggle}
        >
          <BrandLogo
            variant={open ? "solo" : "mark"}
            className={open ? "h-7 w-auto text-[1.75rem]" : "h-8 w-auto text-[2rem]"}
            priority={itemKind === "link"}
          />
        </Link>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1.5 pb-2"
        aria-label="Principal"
      >
        {open ? (
          <p className={cn("px-2.5 pb-1 pt-2", sectionLabel)}>
            Trabalho
          </p>
        ) : (
          <div className="h-2" />
        )}
        {SHELL_WORK_NAV.map((item) => {
          const className = "group relative rounded-md";
          if (itemKind === "static") {
            const active =
              activeId != null &&
              (item.tour === activeId || item.href === `/${activeId}`);
            return (
              <span
                key={item.href}
                data-tour={item.tour}
                title={open ? undefined : item.label}
                className={cn(className, itemRowClass(open, active), "text-[11px]")}
                onClick={stopToggle}
              >
                <WorkFace item={item} open={open} active={active} pending={false} />
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tour}
              title={open ? undefined : item.label}
              aria-label={item.label}
              className={className}
              onClick={stopToggle}
            >
              <WorkLink item={item} open={open} />
            </Link>
          );
        })}

        <div className="mt-auto flex flex-col gap-0.5 pt-3">
          <div className="flex h-5 items-end">
            {open ? (
              <p className={cn("px-2.5", sectionLabel)}>
                Sistema
              </p>
            ) : null}
          </div>
          {SHELL_FOOTER_NAV.map((item) => {
            const key = footerItemKey(item);
            const href = item.billingFrom ? planosHref(from) : item.href;
            const groupActive = isShellFooterGroupActive(
              item,
              pathname,
              searchKind,
            );
            const active = isFooterAccordion(item)
              ? !open && groupActive
              : isShellFooterActive(item, pathname, searchKind);
            const expanded = expandedKey === key;
            const rowClass = "group relative rounded-md";
            const face = (
              <span className={itemRowClass(open, active)}>
                <FooterLinkFace
                  item={item}
                  open={open}
                  active={active}
                  expanded={expanded}
                />
              </span>
            );

            function onAccordionClick(event: MouseEvent) {
              stopToggle(event);
              if (!open) {
                onToggle?.();
                setRailExpanded(key);
                return;
              }
              setRailExpanded(expanded ? null : key);
            }

            function onParentClick(event: MouseEvent) {
              stopToggle(event);
              if (!open || !item.children?.length) return;
              if (expandedKey !== key) {
                event.preventDefault();
                setRailExpanded(key);
              }
            }

            if (isFooterAccordion(item)) {
              return (
                <div key={key}>
                  <button
                    type="button"
                    title={open ? undefined : item.label}
                    aria-label={item.label}
                    aria-expanded={expanded}
                    className={cn(rowClass, "w-full")}
                    onClick={onAccordionClick}
                  >
                    {face}
                  </button>
                  {open && expanded && item.children ? (
                    <div className={cn("mt-0.5 ml-4 flex flex-col gap-0.5 border-l pl-2", railBorder)}>
                      {item.children.map((child) => (
                        <FooterChild
                          key={child.href}
                          child={child}
                          pathname={pathname}
                          searchKind={searchKind}
                          itemKind={itemKind}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }
            if (item.action === "logout") {
              if (itemKind === "static") {
                return (
                  <span
                    key={key}
                    title={open ? undefined : item.label}
                    className={rowClass}
                    onClick={stopToggle}
                  >
                    {face}
                  </span>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  title={open ? undefined : item.label}
                  aria-label={item.label}
                  disabled={leaving}
                  className={cn(rowClass, "w-full disabled:opacity-60")}
                  onClick={(event) => {
                    stopToggle(event);
                    void logout();
                  }}
                >
                  {face}
                </button>
              );
            }
            if (!href) return null;
            return (
              <div key={key}>
                {itemKind === "static" ? (
                  <span
                    title={open ? undefined : item.label}
                    className={rowClass}
                    onClick={onParentClick}
                  >
                    {face}
                  </span>
                ) : (
                  <Link
                    href={href}
                    title={open ? undefined : item.label}
                    aria-label={item.label}
                    aria-expanded={item.children?.length ? expanded : undefined}
                    className={rowClass}
                    onClick={onParentClick}
                  >
                    {face}
                  </Link>
                )}
                {open && expanded && item.children ? (
                  <div className={cn("mt-0.5 ml-4 flex flex-col gap-0.5 border-l pl-2", railBorder)}>
                    {item.children.map((child) => (
                      <FooterChild
                        key={child.href}
                        child={child}
                        pathname={pathname}
                        searchKind={searchKind}
                        itemKind={itemKind}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </nav>

      {onToggle ? (
        <div className={cn("shrink-0 border-t p-2", railBorder)}>
          <button
            type="button"
            onClick={(event) => {
              stopToggle(event);
              onToggle();
            }}
            aria-expanded={open}
            aria-label={open ? "Recolher menu" : "Expandir menu"}
            className={cn(
              "flex w-full items-center rounded-md py-2 text-podium-muted hover:bg-white/5 hover:text-podium-white",
              open ? "gap-2.5 px-2.5" : "justify-center",
            )}
          >
            {open ? (
              <PanelLeftClose className="h-4 w-4 shrink-0" />
            ) : (
              <PanelLeft className="h-4 w-4 shrink-0" />
            )}
            <RailLabel open={open}>Recolher</RailLabel>
          </button>
        </div>
      ) : null}
    </aside>
  );
}
