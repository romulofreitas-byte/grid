import { LOCAL_USER_ID } from "@/lib/data/pg";
import { cloneDefaultCadenceEntries } from "@/lib/crm/cadence";
import { peopleFromDeal } from "@/lib/crm/people";
import type { CrmActivityKind, CrmOutcome } from "@/lib/crm/types";
import type { MockStore } from "@/lib/data/mock-store";

type SeedDeal = {
  company: string;
  contact: string;
  secretaries: string[];
  phones?: string[];
  notes: string;
  stageIndex: number;
  amountCents?: number | null;
  outcome?: CrmOutcome;
  activity?: { kind: CrmActivityKind; dueOffsetMs: number };
};

function hours(n: number): number {
  return n * 60 * 60 * 1000;
}

function days(n: number): number {
  return n * 24 * 60 * 60 * 1000;
}

export function seedCrmStore(store: MockStore, now = Date.now()): void {
  const created = new Date(now).toISOString();
  const alimentosId = "a1000000-0000-4000-8000-000000000001";
  const contabilId = "a1000000-0000-4000-8000-000000000002";
  const cadence = cloneDefaultCadenceEntries();

  store.crm_pipelines.push(
    {
      id: alimentosId,
      user_id: LOCAL_USER_ID,
      nome: "Indústria de Alimentos",
      position: 0,
      created_at: created,
    },
    {
      id: contabilId,
      user_id: LOCAL_USER_ID,
      nome: "Contabilidade",
      position: 1,
      created_at: created,
    },
  );

  const stageIdsFor = (pipelineId: string, prefix: string) =>
    cadence.map((entry, position) => {
      const id = `${prefix}-0000-4000-8000-${String(position).padStart(12, "0")}`;
      store.crm_stages.push({
        id,
        pipeline_id: pipelineId,
        nome: entry.nome,
        position,
        canonical_key: entry.key,
        created_at: created,
      });
      return id;
    });

  const alimentoStages = stageIdsFor(alimentosId, "b1000000");
  const contabilStages = stageIdsFor(contabilId, "b2000000");

  const alimentos: SeedDeal[] = [
    {
      company: "Serra Dourada Alimentos",
      contact: "Helena Duarte",
      secretaries: ["Márcia"],
      phones: ["(34) 3333-1010"],
      notes: "",
      stageIndex: 0,
    },
    {
      company: "Vale do Pão",
      contact: "Carlos Mendes",
      secretaries: ["Lúcia", "Patrícia"],
      notes: "Secretária pediu retorno depois das 15h.",
      stageIndex: 1,
      activity: { kind: "ligar", dueOffsetMs: -days(1) },
    },
    {
      company: "Norte Frio",
      contact: "Renata Pires",
      secretaries: ["Joana"],
      notes: "Pediu para ligar hoje ainda.",
      stageIndex: 1,
      activity: { kind: "ligar", dueOffsetMs: hours(2) },
    },
    {
      company: "Casa Mineira",
      contact: "Paulo Henrique Dias",
      secretaries: [],
      notes: "Não atendeu. Tentar de novo amanhã.",
      stageIndex: 1,
      activity: { kind: "ligar", dueOffsetMs: days(2) },
    },
    {
      company: "Sabor Real",
      contact: "Fernanda Ribeiro",
      secretaries: ["Cristina"],
      notes: "Decisor viajou. Follow-up com a secretária.",
      stageIndex: 2,
      activity: { kind: "followup", dueOffsetMs: hours(3) },
    },
    {
      company: "Aurora dos Grãos",
      contact: "Ricardo Alves",
      secretaries: ["Sônia"],
      notes: "Quer ver a proposta depois da reunião interna.",
      stageIndex: 3,
      activity: { kind: "ligar", dueOffsetMs: -hours(30) },
    },
    {
      company: "Pampa Carnes",
      contact: "Juliana Ferreira",
      secretaries: [],
      notes: "Reunião marcada com o sócio.",
      stageIndex: 4,
      amountCents: 480000,
      activity: { kind: "reuniao", dueOffsetMs: days(4) },
    },
    {
      company: "Moinho Alto",
      contact: "Teresa Lopes",
      secretaries: ["Vera"],
      notes: "Contrato assinado.",
      stageIndex: 9,
      amountCents: 1_250_000,
      outcome: "won",
    },
    {
      company: "Lácteos da Serra",
      contact: "Bruno Oliveira",
      secretaries: ["Elaine"],
      notes: "",
      stageIndex: 1,
      amountCents: 320000,
    },
  ];

  const contabil: SeedDeal[] = [
    {
      company: "Núcleo Contábil",
      contact: "André Vasconcelos",
      secretaries: ["Rita"],
      notes: "",
      stageIndex: 0,
    },
    {
      company: "Livro Aberto",
      contact: "Camila Nascimento",
      secretaries: [],
      notes: "Retornar hoje no comercial.",
      stageIndex: 1,
      activity: { kind: "ligar", dueOffsetMs: hours(1) },
    },
    {
      company: "ContaClara",
      contact: "Sofia Carvalho",
      secretaries: ["Denise"],
      notes: "Ligação caiu. Reagendar.",
      stageIndex: 1,
      activity: { kind: "whatsapp", dueOffsetMs: -days(2) },
    },
  ];

  function pushDeals(pipelineId: string, stageIds: string[], rows: SeedDeal[]) {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const stageId = stageIds[row.stageIndex] ?? stageIds[0]!;
      const position = counts.get(stageId) ?? 0;
      counts.set(stageId, position + 1);
      const dealId = crypto.randomUUID();
      store.crm_deals.push({
        id: dealId,
        pipeline_id: pipelineId,
        stage_id: stageId,
        company_name: row.company,
        contact_name: row.contact,
        secretaries: row.secretaries,
        people: peopleFromDeal({
          contact_name: row.contact,
          secretaries: row.secretaries,
        }),
        phones: row.phones ?? [],
        notes: row.notes,
        cnpj: null,
        meta: {},
        outcome: row.outcome ?? "open",
        amount_cents: row.amountCents ?? null,
        position,
        created_at: created,
        updated_at: created,
      });
      if (row.outcome && row.outcome !== "open") {
        store.crm_events.push({
          id: crypto.randomUUID(),
          deal_id: dealId,
          kind: "outcome",
          body: "",
          meta: { outcome: row.outcome },
          created_at: created,
          updated_at: created,
        });
      }
      if (row.notes.trim()) {
        store.crm_events.push({
          id: crypto.randomUUID(),
          deal_id: dealId,
          kind: "nota",
          body: row.notes,
          meta: {},
          created_at: created,
          updated_at: created,
        });
      }
      if (row.activity) {
        store.crm_activities.push({
          id: crypto.randomUUID(),
          deal_id: dealId,
          kind: row.activity.kind,
          due_at: new Date(now + row.activity.dueOffsetMs).toISOString(),
          status: "open",
          created_at: created,
        });
      }
    });
  }

  pushDeals(alimentosId, alimentoStages, alimentos);
  pushDeals(contabilId, contabilStages, contabil);
}
