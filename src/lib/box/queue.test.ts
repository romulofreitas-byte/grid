import { describe, expect, it } from "vitest";
import {
  boxQueueBucket,
  boxQueueCounts,
  buildBoxQueue,
  compareBoxQueueItems,
  flattenBoxQueue,
  isBoxQueueKind,
  isColdProspectingStage,
  type BoxQueueItem,
  type BoxQueueSource,
} from "./queue";

const now = new Date("2026-09-05T15:00:00-03:00");

function source(
  patch: Partial<BoxQueueSource> & Pick<BoxQueueSource, "activityId" | "companyName">,
): BoxQueueSource {
  return {
    dealId: patch.dealId ?? patch.activityId,
    pipelineId: "pipe-a",
    pipelineNome: "Clínicas",
    contactName: "",
    cnpj: null,
    searchId: null,
    phones: ["34999990000"],
    stageNome: "Entrada",
    canonicalKey: "entrada",
    outcome: "open",
    kind: "ligar",
    dueAt: now.toISOString(),
    status: "open",
    ...patch,
  };
}

function item(
  patch: Partial<BoxQueueItem> & Pick<BoxQueueItem, "id" | "bucket" | "signal" | "dueAt">,
): BoxQueueItem {
  return {
    dealId: patch.dealId ?? patch.id,
    pipelineId: "p",
    pipelineNome: "Nicho",
    companyName: patch.companyName ?? patch.id,
    contactName: "",
    cnpj: null,
    searchId: null,
    phone: "34999990000",
    phones: ["34999990000"],
    stageNome: "Entrada",
    canonicalKey: "entrada",
    kind: "ligar",
    ...patch,
  };
}

describe("isBoxQueueKind", () => {
  it("keeps only ligar and WhatsApp", () => {
    expect(isBoxQueueKind("ligar")).toBe(true);
    expect(isBoxQueueKind("whatsapp")).toBe(true);
    expect(isBoxQueueKind("followup")).toBe(false);
    expect(isBoxQueueKind("email")).toBe(false);
    expect(isBoxQueueKind("reuniao")).toBe(false);
  });
});

describe("isColdProspectingStage", () => {
  it("treats entrada and tentando_contato as cold", () => {
    expect(isColdProspectingStage("entrada")).toBe(true);
    expect(isColdProspectingStage("tentando_contato")).toBe(true);
    expect(isColdProspectingStage("contato_respondido")).toBe(false);
    expect(isColdProspectingStage("followup_decisor")).toBe(false);
    expect(isColdProspectingStage(null)).toBe(false);
  });
});

describe("boxQueueBucket", () => {
  it("puts anything past due in overdue, including cold stages", () => {
    expect(
      boxQueueBucket(
        {
          dueAt: "2026-09-01T12:00:00-03:00",
          status: "open",
          canonicalKey: "entrada",
        },
        now,
      ),
    ).toBe("overdue");
    expect(
      boxQueueBucket(
        {
          dueAt: "2026-09-01T12:00:00-03:00",
          status: "open",
          canonicalKey: "followup_decisor",
        },
        now,
      ),
    ).toBe("overdue");
  });

  it("puts later first-mile outreach in cold and the rest in follow-up", () => {
    expect(
      boxQueueBucket(
        {
          dueAt: "2026-09-05T18:00:00-03:00",
          status: "open",
          canonicalKey: "tentando_contato",
        },
        now,
      ),
    ).toBe("cold");
    expect(
      boxQueueBucket(
        {
          dueAt: "2026-09-06T10:00:00-03:00",
          status: "open",
          canonicalKey: "contato_respondido",
        },
        now,
      ),
    ).toBe("followup");
    expect(
      boxQueueBucket(
        {
          dueAt: "2026-09-05T18:00:00-03:00",
          status: "open",
          canonicalKey: null,
        },
        now,
      ),
    ).toBe("followup");
  });

  it("ignores done activities", () => {
    expect(
      boxQueueBucket(
        {
          dueAt: "2026-09-01T12:00:00-03:00",
          status: "done",
          canonicalKey: "entrada",
        },
        now,
      ),
    ).toBeNull();
  });
});

describe("buildBoxQueue", () => {
  it("drops other kinds, closed deals, and done rows", () => {
    const queue = buildBoxQueue(
      [
        source({
          activityId: "email",
          companyName: "Email Ltda",
          kind: "email",
          canonicalKey: "followup_decisor",
        }),
        source({
          activityId: "won",
          companyName: "Ganho",
          outcome: "won",
          canonicalKey: "negociacao",
        }),
        source({
          activityId: "done",
          companyName: "Feito",
          status: "done",
        }),
        source({
          activityId: "keep",
          companyName: "Keep",
          kind: "whatsapp",
          dueAt: "2026-09-01T09:00:00-03:00",
          canonicalKey: "entrada",
        }),
      ],
      now,
    );
    expect(flattenBoxQueue(queue).map((row) => row.id)).toEqual(["keep"]);
    expect(queue.overdue[0]?.kind).toBe("whatsapp");
  });

  it("orders overdue, then follow-ups, then cold — not by niche", () => {
    const queue = buildBoxQueue(
      [
        source({
          activityId: "cold-b",
          companyName: "Fria B",
          pipelineNome: "Advogados",
          pipelineId: "pipe-b",
          canonicalKey: "entrada",
          dueAt: "2026-09-06T11:00:00-03:00",
        }),
        source({
          activityId: "follow-a",
          companyName: "Follow A",
          pipelineNome: "Clínicas",
          canonicalKey: "followup_decisor",
          stageNome: "Follow-up",
          dueAt: "2026-09-05T16:00:00-03:00",
        }),
        source({
          activityId: "over-old",
          companyName: "Atraso velho",
          pipelineNome: "Advogados",
          pipelineId: "pipe-b",
          canonicalKey: "entrada",
          dueAt: "2026-08-20T10:00:00-03:00",
        }),
        source({
          activityId: "over-new",
          companyName: "Atraso novo",
          canonicalKey: "contato_respondido",
          dueAt: "2026-09-04T10:00:00-03:00",
        }),
        source({
          activityId: "follow-later",
          companyName: "Follow depois",
          canonicalKey: "proposta_apresentada",
          stageNome: "Proposta",
          dueAt: "2026-09-08T10:00:00-03:00",
        }),
        source({
          activityId: "cold-today",
          companyName: "Fria hoje",
          canonicalKey: "tentando_contato",
          stageNome: "Tentando",
          dueAt: "2026-09-05T18:00:00-03:00",
        }),
      ],
      now,
    );

    expect(flattenBoxQueue(queue).map((row) => row.id)).toEqual([
      "over-old",
      "over-new",
      "follow-a",
      "follow-later",
      "cold-today",
      "cold-b",
    ]);
    expect(boxQueueCounts(queue)).toEqual({
      overdue: 2,
      followup: 2,
      cold: 2,
      total: 6,
    });
  });

  it("sorts today before later days inside a bucket", () => {
    const later = item({
      id: "later",
      bucket: "followup",
      signal: "scheduled",
      dueAt: "2026-09-08T08:00:00.000Z",
    });
    const today = item({
      id: "today",
      bucket: "followup",
      signal: "today",
      dueAt: "2026-09-05T21:00:00.000Z",
    });
    expect(compareBoxQueueItems(today, later)).toBeLessThan(0);
  });
});
