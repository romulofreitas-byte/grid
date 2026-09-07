import { httpErrorMessage, readResponseJson } from "@/lib/api-json";

export const CRM_FIELD =
  "w-full rounded-md border border-white/10 bg-podium-panel px-2.5 py-1.5 text-xs font-normal text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

export const CRM_LABEL =
  "text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted";

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
  const body = await readResponseJson<T & { error?: string }>(res);
  if (!res.ok) {
    throw new Error(
      httpErrorMessage(res.status, body, "Não foi possível salvar."),
    );
  }
  if (body == null) {
    throw new Error("Não foi possível salvar.");
  }
  return body;
}

export function sectorLabel(index: number): string {
  return String(index + 1).padStart(2, "0");
}
