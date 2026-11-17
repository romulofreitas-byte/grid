import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { parseNoteImageDataUrl } from "@/lib/crm/note-image-parse";
import {
  extForNoteMime,
  isOwnedNoteImagePath,
  noteImageObjectPath,
} from "@/lib/crm/note-images";
import { getRepo } from "@/lib/data";

const BUCKET = "crm-notes";

function storageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function mimeForPath(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!isOwnedNoteImagePath(gated.userId, dealId, path)) {
    return jsonError("Imagem inválida.");
  }
  const deal = await getRepo().getCrmDeal(gated.userId, dealId);
  if (!deal) return jsonError("Negócio não encontrado.", 404);
  const admin = storageAdmin();
  if (!admin) return jsonError("Imagem não encontrada.", 404);
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return jsonError("Imagem não encontrada.", 404);
  const bytes = new Uint8Array(await data.arrayBuffer());
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mimeForPath(path),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const body = (await readJson(req)) as { dataUrl?: string } | null;
  const parsed = parseNoteImageDataUrl(body?.dataUrl ?? "");
  if (!parsed) {
    return jsonError("Envie uma imagem JPEG, PNG ou WebP de até 4 MB.");
  }
  const deal = await getRepo().getCrmDeal(gated.userId, dealId);
  if (!deal) return jsonError("Negócio não encontrado.", 404);
  const ext = extForNoteMime(parsed.mime);
  const path = ext
    ? noteImageObjectPath(gated.userId, dealId, crypto.randomUUID(), ext)
    : null;
  if (!path) return jsonError("Imagem inválida.");
  const admin = storageAdmin();
  if (!admin) return jsonError("Não foi possível guardar a imagem.", 503);
  const { error } = await admin.storage.from(BUCKET).upload(path, parsed.bytes, {
    contentType: parsed.mime,
    upsert: false,
  });
  if (error) return jsonError("Não foi possível guardar a imagem.", 503);
  return NextResponse.json({ path, mime: parsed.mime });
}
