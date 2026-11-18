import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { parseNoteImageDataUrl } from "@/lib/crm/note-image-parse";
import {
  extForNoteMime,
  isOwnedNoteImagePath,
  noteImageObjectPath,
} from "@/lib/crm/note-images";
import { downloadNoteImage, uploadNoteImage } from "@/lib/crm/note-storage";
import { getRepo } from "@/lib/data";

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
  const file = await downloadNoteImage(path);
  if (!file) return jsonError("Imagem não encontrada.", 404);
  return new NextResponse(new Uint8Array(file), {
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
  const bytes = new Uint8Array(parsed.bytes);
  const uploadError = await uploadNoteImage(path, bytes, parsed.mime);
  if (uploadError) {
    console.error("crm note image upload", uploadError);
    return jsonError("Não foi possível guardar a imagem.", 503);
  }
  return NextResponse.json({ path, mime: parsed.mime });
}
