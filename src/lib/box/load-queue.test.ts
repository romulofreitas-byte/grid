import { afterEach, describe, expect, it } from "vitest";
import { boxQueueShowsCrmIdle } from "@/lib/box/queue";
import { loadBoxQueue } from "@/lib/box/load-queue";
import { mockRepo } from "@/lib/data/mock-repo";
import { getMockStore } from "@/lib/data/mock-store";

const USER = "box-queue-user";
const now = new Date("2026-09-08T15:00:00-03:00");
const flags = { crmAllowed: true, trialExpired: false };

function cleanupUser() {
  const store = getMockStore();
  const ids = new Set(
    store.crm_pipelines.filter((row) => row.user_id === USER).map((row) => row.id),
  );
  store.crm_activities = store.crm_activities.filter((row) => {
    const deal = store.crm_deals.find((d) => d.id === row.deal_id);
    return !deal || !ids.has(deal.pipeline_id);
  });
  store.crm_events = store.crm_events.filter((row) => {
    const deal = store.crm_deals.find((d) => d.id === row.deal_id);
    return !deal || !ids.has(deal.pipeline_id);
  });
  store.crm_deals = store.crm_deals.filter((row) => !ids.has(row.pipeline_id));
  store.crm_stages = store.crm_stages.filter((row) => !ids.has(row.pipeline_id));
  store.crm_pipelines = store.crm_pipelines.filter((row) => row.user_id !== USER);
}

describe("loadBoxQueue", () => {
  afterEach(cleanupUser);

  it("marks idle CRM work when deals exist without ligar or WhatsApp", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho box");
    await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Sem ligação",
    });
    const payload = await loadBoxQueue(USER, now, flags);
    expect(payload.counts.total).toBe(0);
    expect(payload.openDealCount).toBe(1);
    expect(payload.openOtherActivityCount).toBe(0);
    expect(boxQueueShowsCrmIdle(payload)).toBe(true);
  });

  it("puts an open ligar activity on the queue", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho box");
    const deal = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Ligar agora",
    });
    await mockRepo.scheduleCrmActivity(
      USER,
      deal!.id,
      "ligar",
      "2026-09-08T12:00:00-03:00",
    );
    const payload = await loadBoxQueue(USER, now, flags);
    expect(payload.counts.total).toBe(1);
    expect(payload.overdue).toHaveLength(1);
    expect(payload.overdue[0]?.companyName).toBe("Ligar agora");
    expect(boxQueueShowsCrmIdle(payload)).toBe(false);
  });

  it("keeps a followup activity off the queue and counts it as other work", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho box");
    const deal = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Só follow-up",
    });
    await mockRepo.scheduleCrmActivity(
      USER,
      deal!.id,
      "followup",
      "2026-09-08T12:00:00-03:00",
    );
    const payload = await loadBoxQueue(USER, now, flags);
    expect(payload.counts.total).toBe(0);
    expect(payload.openDealCount).toBe(1);
    expect(payload.openOtherActivityCount).toBe(1);
    expect(boxQueueShowsCrmIdle(payload)).toBe(true);
  });

  it("hides CRM work when the plan does not allow the box", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho box");
    const deal = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Bloqueado",
    });
    await mockRepo.scheduleCrmActivity(
      USER,
      deal!.id,
      "ligar",
      "2026-09-08T12:00:00-03:00",
    );
    const payload = await loadBoxQueue(USER, now, {
      crmAllowed: false,
      trialExpired: false,
    });
    expect(payload.counts.total).toBe(0);
    expect(payload.openDealCount).toBe(0);
    expect(payload.openOtherActivityCount).toBe(0);
    expect(payload.crmAllowed).toBe(false);
  });
});
