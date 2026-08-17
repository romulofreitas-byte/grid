import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { extForMime, parseImageDataUrl } from "@/lib/avatar-upload";

function storageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const body = (await req.json()) as { dataUrl?: string };
  const parsed = parseImageDataUrl(body.dataUrl ?? "");
  if (!parsed) {
    return NextResponse.json(
      { error: "Envie uma foto JPEG, PNG ou WebP de até 1 MB." },
      { status: 400 },
    );
  }

  let fotoUrl: string | null = null;
  const admin = storageAdmin();
  if (admin) {
    const ext = extForMime(parsed.mime);
    const path = `${gated.userId}/avatar.${ext}`;
    const { error } = await admin.storage.from("avatars").upload(path, parsed.bytes, {
      contentType: parsed.mime,
      upsert: true,
    });
    if (!error) {
      const { data } = admin.storage.from("avatars").getPublicUrl(path);
      fotoUrl = `${data.publicUrl}?v=${Date.now()}`;
    }
  }
  if (!fotoUrl) {
    fotoUrl = `data:${parsed.mime};base64,${parsed.bytes.toString("base64")}`;
  }

  const profile = await getRepo().updateProfile(gated.userId, { foto_url: fotoUrl });
  return NextResponse.json(profile);
}
