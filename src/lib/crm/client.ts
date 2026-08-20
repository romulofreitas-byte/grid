export const CRM_FIELD =
  "w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2 text-sm text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

export const CRM_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-podium-muted";

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
