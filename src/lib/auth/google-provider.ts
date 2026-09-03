/** Public GoTrue settings: whether Google is enabled on this Supabase project. */
export async function isGoogleAuthEnabled(): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { external?: { google?: unknown } };
    if (typeof body.external?.google !== "boolean") return null;
    return body.external.google;
  } catch {
    return null;
  }
}
