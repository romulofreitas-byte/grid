/** Re-run site discovery after ranking rules change. Off: a paid click only. */
export async function enqueueDiscoveryRetries(_input: {
  cnpjs: string[];
  userId: string;
  searchId: string | null;
  priority?: boolean;
}): Promise<number> {
  return 0;
}
