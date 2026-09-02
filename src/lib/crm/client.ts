export const CRM_FIELD =
  "w-full rounded-md border border-white/10 bg-podium-panel px-2.5 py-1.5 text-xs font-normal text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

export const CRM_LABEL =
  "text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted";

export const CRM_FIELD_LIGHT =
  "w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-normal text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-amber-400";

export const CRM_LABEL_LIGHT =
  "text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500";

export async function crmFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || "Não foi possível salvar.");
  }
  return body;
}

export function sectorLabel(index: number): string {
  return String(index + 1).padStart(2, "0");
}
