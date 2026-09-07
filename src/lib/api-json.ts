import { COPY } from "@/lib/copy";

export const HTTP_TIMEOUT_STATUSES = new Set([408, 504, 524]);

export async function readResponseJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function httpErrorMessage(
  status: number,
  body: { error?: string } | null,
  fallback: string,
  timeoutMessage: string = COPY.apiTimeout,
): string {
  const fromBody = body?.error?.trim();
  if (fromBody) return fromBody;
  if (HTTP_TIMEOUT_STATUSES.has(status)) return timeoutMessage;
  return fallback;
}
