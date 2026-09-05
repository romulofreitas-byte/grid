import {
  dailyGoalFromMeta,
  parseTaxasOrigem,
  type MetaInput,
  type MetaApplyResult,
  type PilotMeta,
} from "@/lib/calculadora/meta";
import { DEFAULT_TAXAS } from "@/lib/calculadora/funnel";
import { isUndefinedTableError, query } from "@/lib/data/pg";

function asIso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function mapMeta(row: Record<string, unknown>): PilotMeta {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    created_by: String(row.created_by),
    nome: String(row.nome ?? ""),
    tipo_empresa: String(row.tipo_empresa ?? ""),
    metaFaturamento: Number(row.meta_faturamento ?? 0),
    ticket: Number(row.ticket ?? 0),
    prazoMeses: Number(row.prazo_meses ?? 0),
    taxa1: Number(row.taxa1 ?? DEFAULT_TAXAS.taxa1),
    taxa2: Number(row.taxa2 ?? DEFAULT_TAXAS.taxa2),
    taxa3: Number(row.taxa3 ?? DEFAULT_TAXAS.taxa3),
    taxa4: Number(row.taxa4 ?? DEFAULT_TAXAS.taxa4),
    taxasOrigem: parseTaxasOrigem(row.taxas_origem),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  };
}

const META_COLUMNS = `
  id, user_id, created_by, nome, tipo_empresa,
  meta_faturamento, ticket, prazo_meses,
  taxa1, taxa2, taxa3, taxa4, taxas_origem,
  created_at, updated_at
`;

async function getOwnedMeta(
  userId: string,
  metaId: string,
): Promise<PilotMeta | null> {
  try {
    const { rows } = await query(
      `select ${META_COLUMNS} from metas where id = $1 and user_id = $2`,
      [metaId, userId],
    );
    return rows[0] ? mapMeta(rows[0]) : null;
  } catch (err) {
    if (isUndefinedTableError(err)) return null;
    throw err;
  }
}

export const metasPgMethods = {
  async listMetas(userId: string): Promise<PilotMeta[]> {
    try {
      const { rows } = await query(
        `select ${META_COLUMNS}
           from metas
          where user_id = $1
          order by (id = (select active_meta_id from profiles where id = $1)) desc nulls last,
                   updated_at desc`,
        [userId],
      );
      return rows.map(mapMeta);
    } catch (err) {
      if (isUndefinedTableError(err)) return [];
      throw err;
    }
  },

  async createMeta(userId: string, input: MetaInput): Promise<PilotMeta> {
    const { rows } = await query(
      `insert into metas (
         user_id, created_by, nome, tipo_empresa,
         meta_faturamento, ticket, prazo_meses,
         taxa1, taxa2, taxa3, taxa4, taxas_origem
       )
       values ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning ${META_COLUMNS}`,
      [
        userId,
        input.nome,
        input.tipo_empresa,
        input.metaFaturamento,
        input.ticket,
        input.prazoMeses,
        input.taxa1,
        input.taxa2,
        input.taxa3,
        input.taxa4,
        input.taxasOrigem,
      ],
    );
    return mapMeta(rows[0]);
  },

  async updateMeta(
    userId: string,
    metaId: string,
    patch: Partial<MetaInput>,
  ): Promise<PilotMeta | null> {
    const current = await getOwnedMeta(userId, metaId);
    if (!current) return null;
    const next = { ...current, ...patch };
    try {
      const { rows } = await query(
        `update metas set
           nome = $3, tipo_empresa = $4,
           meta_faturamento = $5, ticket = $6, prazo_meses = $7,
           taxa1 = $8, taxa2 = $9, taxa3 = $10, taxa4 = $11,
           taxas_origem = $12, updated_at = now()
         where id = $1 and user_id = $2
         returning ${META_COLUMNS}`,
        [
          metaId,
          userId,
          next.nome,
          next.tipo_empresa,
          next.metaFaturamento,
          next.ticket,
          next.prazoMeses,
          next.taxa1,
          next.taxa2,
          next.taxa3,
          next.taxa4,
          next.taxasOrigem,
        ],
      );
      return rows[0] ? mapMeta(rows[0]) : null;
    } catch (err) {
      if (isUndefinedTableError(err)) return null;
      throw err;
    }
  },

  async deleteMeta(userId: string, metaId: string): Promise<boolean> {
    try {
      await query(
        `update profiles
            set active_meta_id = null
          where id = $1 and active_meta_id = $2`,
        [userId, metaId],
      );
      const { rowCount } = await query(
        `delete from metas where id = $1 and user_id = $2`,
        [metaId, userId],
      );
      return (rowCount ?? 0) > 0;
    } catch (err) {
      if (isUndefinedTableError(err)) return false;
      throw err;
    }
  },

  async applyMeta(
    userId: string,
    metaId: string,
  ): Promise<MetaApplyResult> {
    const meta = await getOwnedMeta(userId, metaId);
    if (!meta) return { status: "not_found" };
    const goal = dailyGoalFromMeta(meta);
    if (goal == null) return { status: "not_ready" };
    await query(
      `update profiles
          set active_meta_id = $2, meta_ligacoes_dia = $3
        where id = $1`,
      [userId, metaId, goal],
    );
    return { status: "ok", meta, metaLigacoesDia: goal };
  },
};
