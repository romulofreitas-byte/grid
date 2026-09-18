import { describe, expect, it } from "vitest";
import { mockRepo } from "@/lib/data/mock-repo";
import { getMockStore } from "@/lib/data/mock-store";
import { LOCAL_USER_ID } from "@/lib/data/pg";

const ready = {
  nome: "Clínicas",
  tipo_empresa: "Saúde",
  metaFaturamento: 80_000,
  ticket: 15_000,
  prazoMeses: 3,
  taxaContato: 100,
  taxa1: 20,
  taxa2: 70,
  taxa3: 80,
  taxa4: 50,
  taxasOrigem: "padrao" as const,
};

describe("mock metas", () => {
  it("keeps one active meta on the Box and does not reset the ring on delete", async () => {
    const store = getMockStore();
    store.metas = [];
    const profile = store.profiles.find((row) => row.id === LOCAL_USER_ID)!;
    profile.active_meta_id = null;
    profile.meta_ligacoes_dia = 20;

    const first = await mockRepo.createMeta(LOCAL_USER_ID, ready);
    const second = await mockRepo.createMeta(LOCAL_USER_ID, {
      ...ready,
      nome: "Indústria",
      tipo_empresa: "B2B",
      ticket: 4_000,
    });

    const appliedFirst = await mockRepo.applyMeta(LOCAL_USER_ID, first.id);
    expect(appliedFirst.status).toBe("ok");
    expect(profile.active_meta_id).toBe(first.id);
    const firstGoal = profile.meta_ligacoes_dia;

    const appliedSecond = await mockRepo.applyMeta(LOCAL_USER_ID, second.id);
    expect(appliedSecond.status).toBe("ok");
    expect(profile.active_meta_id).toBe(second.id);
    expect(profile.meta_ligacoes_dia).not.toBe(firstGoal);

    const listed = await mockRepo.listMetas(LOCAL_USER_ID);
    expect(listed).toHaveLength(2);
    expect(listed[0].id).toBe(second.id);

    const ring = profile.meta_ligacoes_dia;
    expect(await mockRepo.deleteMeta(LOCAL_USER_ID, second.id)).toBe(true);
    expect(profile.active_meta_id).toBeNull();
    expect(profile.meta_ligacoes_dia).toBe(ring);
    expect(await mockRepo.listMetas(LOCAL_USER_ID)).toHaveLength(1);
  });

  it("lists the Box meta first even when another is newer", async () => {
    const store = getMockStore();
    store.metas = [];
    const profile = store.profiles.find((row) => row.id === LOCAL_USER_ID)!;
    profile.active_meta_id = null;

    const first = await mockRepo.createMeta(LOCAL_USER_ID, ready);
    await mockRepo.createMeta(LOCAL_USER_ID, {
      ...ready,
      nome: "Indústria",
    });

    const applied = await mockRepo.applyMeta(LOCAL_USER_ID, first.id);
    expect(applied.status).toBe("ok");
    expect((await mockRepo.listMetas(LOCAL_USER_ID))[0].id).toBe(first.id);
  });

  it("rejects apply until the funnel is ready", async () => {
    const store = getMockStore();
    store.metas = [];
    const draft = await mockRepo.createMeta(LOCAL_USER_ID, {
      ...ready,
      metaFaturamento: 0,
      prazoMeses: 0,
      nome: "Rascunho",
    });
    expect(await mockRepo.applyMeta(LOCAL_USER_ID, draft.id)).toEqual({
      status: "not_ready",
    });
    expect(await mockRepo.applyMeta(LOCAL_USER_ID, "missing")).toEqual({
      status: "not_found",
    });
  });

  it("round-trips manual rates and refreshes the Box ring when that meta is active", async () => {
    const store = getMockStore();
    store.metas = [];
    const profile = store.profiles.find((row) => row.id === LOCAL_USER_ID)!;
    profile.active_meta_id = null;
    profile.meta_ligacoes_dia = 20;

    const created = await mockRepo.createMeta(LOCAL_USER_ID, {
      ...ready,
      taxaContato: 50,
      taxa1: 15,
      taxa2: 60,
      taxa3: 70,
      taxa4: 30,
      taxasOrigem: "manual",
    });
    const listed = await mockRepo.listMetas(LOCAL_USER_ID);
    expect(listed[0]).toMatchObject({
      id: created.id,
      taxaContato: 50,
      taxa1: 15,
      taxa2: 60,
      taxa3: 70,
      taxa4: 30,
      taxasOrigem: "manual",
    });

    const applied = await mockRepo.applyMeta(LOCAL_USER_ID, created.id);
    expect(applied.status).toBe("ok");
    if (applied.status === "ok") {
      expect(applied.metaLigacoesDia).not.toBe(9);
      expect(profile.meta_ligacoes_dia).toBe(applied.metaLigacoesDia);
    }
    const ringAfterApply = profile.meta_ligacoes_dia;

    const updated = await mockRepo.updateMeta(LOCAL_USER_ID, created.id, {
      taxaContato: 25,
      taxasOrigem: "manual",
    });
    expect(updated?.taxaContato).toBe(25);
    expect(profile.active_meta_id).toBe(created.id);
    expect(profile.meta_ligacoes_dia).not.toBe(ringAfterApply);
    expect(profile.meta_ligacoes_dia).toBeGreaterThan(ringAfterApply);
  });
});
