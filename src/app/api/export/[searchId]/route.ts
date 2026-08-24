import { NextResponse } from "next/server";
import { getSearchForUser } from "@/lib/auth/search-access";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { debitExport } from "@/lib/billing/service";
import { insufficientCreditsPayload } from "@/lib/billing/paywall";
import { InsufficientCreditsError } from "@/lib/billing/types";
import { getRepo } from "@/lib/data";
import { buildCsv, buildXlsx } from "@/lib/export/xlsx-csv";
import { buildPdf } from "@/lib/export/pdf";

export const maxDuration = 60;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ searchId: string }> },
) {
  const gated = await guardApi(req, "export");
  if (isGuardReject(gated)) return gated;
  const { searchId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "csv";
  const repo = getRepo();
  const search = await getSearchForUser(gated.userId, searchId);
  if (!search) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  const leads = (await repo.getAllLeadsForExport(searchId)).slice(
    0,
    format === "pdf" ? 50 : 1000,
  );

  try {
    await debitExport(
      gated.userId,
      leads.map((l) => l.establishment.cnpj),
      searchId,
    );
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        insufficientCreditsPayload(err.needed, err.available),
        { status: 402 },
      );
    }
    throw err;
  }

  if (format === "xlsx") {
    const buf = await buildXlsx(leads, {
      nome: search.nome,
      total: search.total_found ?? leads.length,
      created_at: search.created_at,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="grid-${searchId}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const segments = await repo.listSegments();
    const segmentNames = Object.fromEntries(
      segments.map((s) => [s.id, s.nome] as const),
    );
    const buf = await buildPdf(leads, {
      nome: search.nome,
      total: search.total_found ?? leads.length,
      created_at: search.created_at,
      filters: search.filtros,
      segmentNames,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="grid-${searchId}.pdf"`,
      },
    });
  }

  const csv = buildCsv(leads);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="grid-${searchId}.csv"`,
    },
  });
}
