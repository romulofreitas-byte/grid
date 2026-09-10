import { afterEach, describe, expect, it } from "vitest";
import { attachCallRecordingToDeal, safeRecordingUrl } from "./attach-recording";
import { mockRepo } from "@/lib/data/mock-repo";
import { getMockStore } from "@/lib/data/mock-store";

const USER = "attach-recording-user";
const MP3 =
  "https://listener.api4com.com/files/listen/2ee13fa4-975c-499d-bbb8-5177ff418316.mp3";

function cleanup() {
  const store = getMockStore();
  const pipeIds = new Set(
    store.crm_pipelines.filter((row) => row.user_id === USER).map((row) => row.id),
  );
  store.crm_events = store.crm_events.filter((row) => {
    const deal = store.crm_deals.find((d) => d.id === row.deal_id);
    return !deal || !pipeIds.has(deal.pipeline_id);
  });
  store.crm_activities = store.crm_activities.filter((row) => {
    const deal = store.crm_deals.find((d) => d.id === row.deal_id);
    return !deal || !pipeIds.has(deal.pipeline_id);
  });
  store.crm_deals = store.crm_deals.filter((row) => !pipeIds.has(row.pipeline_id));
  store.crm_stages = store.crm_stages.filter((row) => !pipeIds.has(row.pipeline_id));
  store.crm_pipelines = store.crm_pipelines.filter((row) => row.user_id !== USER);
}

describe("safeRecordingUrl", () => {
  it("keeps https MP3s and drops everything else", () => {
    expect(safeRecordingUrl(MP3)).toBe(MP3);
    expect(safeRecordingUrl("http://listener.api4com.com/x.mp3")).toBeNull();
    expect(safeRecordingUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("attachCallRecordingToDeal", () => {
  afterEach(cleanup);

  it("pins the player on the latest ligar event", async () => {
    const store = getMockStore();
    const cnpj = store.establishments[0]!.cnpj;
    const pipeline = await mockRepo.createCrmPipeline(USER, "Clínicas");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Padaria",
      cnpj,
    });
    await mockRepo.logCrmCall(USER, created!.id, "Falei com a secretária.");

    const result = await attachCallRecordingToDeal(mockRepo, {
      userId: USER,
      cnpj,
      recordingUrl: MP3,
    });
    expect(result?.event.meta.record_url).toBe(MP3);
    expect(result?.event.body).toBe("Falei com a secretária.");

    const events = await mockRepo.listCrmEvents(USER, created!.id);
    expect(events?.filter((row) => row.kind === "ligar")).toHaveLength(1);
  });

  it("finds the card by dealId when there is no CNPJ", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Pessoas");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Ana",
      cnpj: null,
    });

    const result = await attachCallRecordingToDeal(mockRepo, {
      userId: USER,
      dealId: created!.id,
      recordingUrl: MP3,
    });
    expect(result?.deal.id).toBe(created!.id);
    expect(result?.event.meta.record_url).toBe(MP3);
  });
});
