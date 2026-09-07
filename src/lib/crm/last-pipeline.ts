import { pickDefaultCrmPipeline } from "@/lib/crm/bridge";

export const LAST_CRM_PIPELINE_COOKIE = "grid_crm_pipeline";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseLastCrmPipelineId(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep raw */
  }
  value = value.trim();
  return UUID_RE.test(value) ? value : null;
}

export function readLastCrmPipelineId(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === LAST_CRM_PIPELINE_COOKIE) {
      return parseLastCrmPipelineId(rest.join("="));
    }
  }
  return null;
}

export function lastCrmPipelineCookie(pipelineId: string | null): string {
  if (!pipelineId) {
    return `${LAST_CRM_PIPELINE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  return `${LAST_CRM_PIPELINE_COOKIE}=${encodeURIComponent(pipelineId)}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax`;
}

export function writeLastCrmPipelineCookie(pipelineId: string | null) {
  if (typeof document === "undefined") return;
  document.cookie = lastCrmPipelineCookie(pipelineId);
}

export function resolveCrmPipeline<T extends { id: string; deal_count: number }>(
  pipelines: T[],
  requestedId?: string | null,
  rememberedId?: string | null,
): T | undefined {
  if (requestedId) {
    const requested = pipelines.find((pipeline) => pipeline.id === requestedId);
    if (requested) return requested;
  }
  if (rememberedId) {
    const remembered = pipelines.find((pipeline) => pipeline.id === rememberedId);
    if (remembered) return remembered;
  }
  return pickDefaultCrmPipeline(pipelines);
}
