import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { filterQualifiedCnpjs } from "@/lib/billing/service";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";
import {
  uniqueCompanyCnpjs,
  type CompanyGridContext,
} from "@/lib/empresas/context";

export async function GET(req: Request) {
  const gated = await guardApi(req, "search");
  if (isGuardReject(gated)) return gated;
  const cnpjs = uniqueCompanyCnpjs(
    (new URL(req.url).searchParams.get("cnpjs") ?? "").split(","),
  );
  if (cnpjs.length === 0) return NextResponse.json({ items: [] });
  try {
    const [placements, qualified] = await Promise.all([
      getRepo().listCompanyGridContext(gated.userId, cnpjs),
      filterQualifiedCnpjs(gated.userId, cnpjs),
    ]);
    const qualifiedSet = new Set(qualified);
    const byCnpj = new Map(placements.map((row) => [row.cnpj, row]));
    const items: CompanyGridContext[] = cnpjs.map((cnpj) => {
      const row = byCnpj.get(cnpj);
      return {
        cnpj,
        called: row?.called ?? false,
        crm: row?.crm ?? null,
        list: row?.list ?? null,
        qualified: qualifiedSet.has(cnpj),
      };
    });
    return NextResponse.json({ items });
  } catch (err) {
    return dbUnavailableResponse(err, "empresas_contexto");
  }
}
