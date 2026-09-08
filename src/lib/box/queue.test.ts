import { describe, expect, it } from "vitest";
import {
  boxQueueBucket,
  boxQueueCounts,
  boxQueueShowsCrmIdle,
  buildBoxQueue,
  compareBoxQueueItems,
  flattenBoxQueue,
  isBoxQueueKind,
  isColdProspectingStage,
  pickBoxQueueTab,
  type BoxQueueItem,
  type BoxQueueSource,
} from "./queue";

/** Tuesday 8 Sep 2026, 15:00 São Paulo. */
const now = new Date("2026-09-08T15:00:00-03:00");

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
    lastNote: "",
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
    lastNote: null,
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
  it("puts anything past due in overdue, including today's already-passed time", () => {
    expect(
      boxQueueBucket(
        { dueAt: "2026-09-01T12:00:00-03:00", status: "open" },
        now,
      ),
    ).toBe("overdue");
    expect(
      boxQueueBucket(
        { dueAt: "2026-09-08T12:00:00-03:00", status: "open" },
        now,
      ),
    ).toBe("overdue");
  });

  it("splits remaining work by São Paulo day: today, tomorrow, rest of week, later", () => {
    expect(
      boxQueueBucket(
        { dueAt: "2026-09-08T18:00:00-03:00", status: "open" },
        now,
      ),
    ).toBe("today");
    expect(
      boxQueueBucket(
        { dueAt: "2026-09-09T10:00:00-03:00", status: "open" },
        now,
      ),
    ).toBe("tomorrow");
    expect(
      boxQueueBucket(
        { dueAt: "2026-09-11T10:00:00-03:00", status: "open" },
        now,
      ),
    ).toBe("week");
    expect(
      boxQueueBucket(
        { dueAt: "2026-09-13T10:00:00-03:00", status: "open" },
        now,
      ),
    ).toBe("week");
    expect(
      boxQueueBucket(
        { dueAt: "2026-09-14T10:00:00-03:00", status: "open" },
        now,
      ),
    ).toBe("later");
  });

  it("ignores done activities", () => {
    expect(
      boxQueueBucket(
        { dueAt: "2026-09-01T12:00:00-03:00", status: "done" },
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

  it("keeps lastNote when the deal has notes, otherwise null", () => {
    const queue = buildBoxQueue(
      [
        source({
          activityId: "with-note",
          companyName: "Com nota",
          lastNote: "  Falou com a secretária.  ",
          dueAt: "2026-09-08T18:00:00-03:00",
        }),
        source({
          activityId: "blank",
          companyName: "Sem nota",
          lastNote: "   ",
          dueAt: "2026-09-08T19:00:00-03:00",
        }),
      ],
      now,
    );
    expect(queue.today[0]?.lastNote).toBe("Falou com a secretária.");
    expect(queue.today[1]?.lastNote).toBeNull();
  });

  it("orders overdue, today, tomorrow, this week, then later", () => {
    const queue = buildBoxQueue(
      [
        source({
          activityId: "later",
          companyName: "Depois",
          dueAt: "2026-09-15T11:00:00-03:00",
        }),
        source({
          activityId: "week",
          companyName: "Semana",
          dueAt: "2026-09-11T11:00:00-03:00",
        }),
        source({
          activityId: "today",
          companyName: "Hoje",
          dueAt: "2026-09-08T18:00:00-03:00",
        }),
        source({
          activityId: "over-old",
          companyName: "Atraso velho",
          dueAt: "2026-08-20T10:00:00-03:00",
        }),
        source({
          activityId: "over-new",
          companyName: "Atraso novo",
          dueAt: "2026-09-04T10:00:00-03:00",
        }),
        source({
          activityId: "tomorrow",
          companyName: "Amanhã",
          dueAt: "2026-09-09T10:00:00-03:00",
        }),
      ],
      now,
    );

    expect(flattenBoxQueue(queue).map((row) => row.id)).toEqual([
      "over-old",
      "over-new",
      "today",
      "tomorrow",
      "week",
      "later",
    ]);
    expect(boxQueueCounts(queue)).toEqual({
      overdue: 2,
      today: 1,
      tomorrow: 1,
      week: 1,
      later: 1,
      total: 6,
    });
  });

  it("sorts earlier due times first inside a bucket", () => {
    const later = item({
      id: "later",
      bucket: "week",
      signal: "scheduled",
      dueAt: "2026-09-12T08:00:00.000Z",
    });
    const sooner = item({
      id: "sooner",
      bucket: "week",
      signal: "scheduled",
      dueAt: "2026-09-11T08:00:00.000Z",
    });
    expect(compareBoxQueueItems(sooner, later)).toBeLessThan(0);
  });
});

describe("pickBoxQueueTab", () => {
  it("picks the first non-empty time bucket", () => {
    expect(
      pickBoxQueueTab({
        overdue: 0,
        today: 2,
        tomorrow: 1,
        week: 0,
        later: 0,
        total: 3,
      }),
    ).toBe("today");
    expect(
      pickBoxQueueTab({
        overdue: 1,
        today: 2,
        tomorrow: 0,
        week: 0,
        later: 0,
        total: 3,
      }),
    ).toBe("overdue");
  });
});

describe("boxQueueShowsCrmIdle", () => {
  const emptyCounts = {
    overdue: 0,
    today: 0,
    tomorrow: 0,
    week: 0,
    later: 0,
    total: 0,
  };

  it("is true when the queue is empty but the CRM has open work", () => {
    expect(
      boxQueueShowsCrmIdle({
        counts: emptyCounts,
        openDealCount: 2,
        openOtherActivityCount: 0,
      }),
    ).toBe(true);
    expect(
      boxQueueShowsCrmIdle({
        counts: emptyCounts,
        openDealCount: 0,
        openOtherActivityCount: 1,
      }),
    ).toBe(true);
  });

  it("is false when the box already has a queue or the CRM is empty", () => {
    expect(
      boxQueueShowsCrmIdle({
        counts: { ...emptyCounts, overdue: 1, total: 1 },
        openDealCount: 3,
        openOtherActivityCount: 0,
      }),
    ).toBe(false);
    expect(
      boxQueueShowsCrmIdle({
        counts: emptyCounts,
        openDealCount: 0,
        openOtherActivityCount: 0,
      }),
    ).toBe(false);
  });
});
