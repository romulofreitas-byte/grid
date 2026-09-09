"use client";

import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import type { CrmMetaConnection } from "@/lib/crm/types";

export function startMetaOAuth() {
  window.location.href = "/api/automacoes/meta/oauth";
}

export function MetaConnectCard({
  pages,
  configured,
  compact = false,
}: {
  pages: CrmMetaConnection[];
  configured?: boolean;
  compact?: boolean;
}) {
  const ready = configured !== false;
  const names = pages.map((page) => page.page_name);
  return (
    <div
      className={
        compact
          ? "space-y-2 rounded-md border border-white/10 bg-black/20 px-3 py-2"
          : "space-y-3"
      }
    >
      {compact ? (
        <p className="text-[11px] font-semibold text-podium-white">
          {COPY.automacoesOriginMeta}
        </p>
      ) : null}
      {names.length > 0 ? (
        <p className="text-xs text-podium-gray">{names.join(" · ")}</p>
      ) : null}
      {ready ? (
        <>
          <Button
            type="button"
            variant={compact ? "secondary" : "primary"}
            size={compact ? "sm" : "md"}
            onClick={startMetaOAuth}
          >
            {names.length > 0
              ? COPY.automacoesConnectMetaAgain
              : COPY.automacoesConnectMeta}
          </Button>
          {names.length === 0 ? (
            <p className="text-xs text-podium-muted">
              {COPY.automacoesMetaPagesEmpty}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-podium-muted">
          {COPY.automacoesMetaNotConfigured}
        </p>
      )}
    </div>
  );
}
