export function formatNichoCidade(
  nicho?: string | null,
  cidade?: string | null,
): string {
  return [nicho?.trim(), cidade?.trim()].filter(Boolean).join(" · ");
}

export function resolveNichoNome(input: {
  pipelineNome?: string | null;
  segmentNome?: string | null;
}): string | null {
  const pipeline = input.pipelineNome?.trim();
  if (pipeline) return pipeline;
  const segment = input.segmentNome?.trim();
  return segment || null;
}

export async function resolveFichaNichoNome(
  getPreset: (id: string) => Promise<{ nome: string } | undefined | null>,
  input: {
    pipelineNome?: string | null;
    segmentId?: string | null;
  },
): Promise<string | null> {
  const fromPipeline = resolveNichoNome({ pipelineNome: input.pipelineNome });
  if (fromPipeline) return fromPipeline;
  const segmentId = input.segmentId?.trim();
  if (!segmentId) return null;
  const preset = await getPreset(segmentId);
  return resolveNichoNome({ segmentNome: preset?.nome });
}
