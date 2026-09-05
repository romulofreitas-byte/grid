import {
  dailyGoalFromMeta,
  type MetaInput,
  type MetaApplyResult,
  type PilotMeta,
} from "@/lib/calculadora/meta";
import { getMockStore } from "@/lib/data/mock-store";

function nowIso(): string {
  return new Date().toISOString();
}

function clone(meta: PilotMeta): PilotMeta {
  return { ...meta };
}

export const metasMockMethods = {
  async listMetas(userId: string): Promise<PilotMeta[]> {
    return getMockStore()
      .metas.filter((row) => row.user_id === userId)
      .slice()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(clone);
  },

  async createMeta(userId: string, input: MetaInput): Promise<PilotMeta> {
    const stamp = nowIso();
    const meta: PilotMeta = {
      id: crypto.randomUUID(),
      user_id: userId,
      created_by: userId,
      ...input,
      created_at: stamp,
      updated_at: stamp,
    };
    getMockStore().metas.push(meta);
    return clone(meta);
  },

  async updateMeta(
    userId: string,
    metaId: string,
    patch: Partial<MetaInput>,
  ): Promise<PilotMeta | null> {
    const meta = getMockStore().metas.find(
      (row) => row.id === metaId && row.user_id === userId,
    );
    if (!meta) return null;
    Object.assign(meta, patch, { updated_at: nowIso() });
    return clone(meta);
  },

  async deleteMeta(userId: string, metaId: string): Promise<boolean> {
    const store = getMockStore();
    const index = store.metas.findIndex(
      (row) => row.id === metaId && row.user_id === userId,
    );
    if (index < 0) return false;
    store.metas.splice(index, 1);
    const profile = store.profiles.find((row) => row.id === userId);
    if (profile?.active_meta_id === metaId) {
      profile.active_meta_id = null;
    }
    return true;
  },

  async applyMeta(
    userId: string,
    metaId: string,
  ): Promise<MetaApplyResult> {
    const store = getMockStore();
    const meta = store.metas.find(
      (row) => row.id === metaId && row.user_id === userId,
    );
    if (!meta) return { status: "not_found" };
    const goal = dailyGoalFromMeta(meta);
    if (goal == null) return { status: "not_ready" };
    const profile = store.profiles.find((row) => row.id === userId);
    if (profile) {
      profile.active_meta_id = meta.id;
      profile.meta_ligacoes_dia = goal;
    }
    return { status: "ok", meta: clone(meta), metaLigacoesDia: goal };
  },
};
