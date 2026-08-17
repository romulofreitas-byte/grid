/** Edge-safe: used by middleware and server auth. */
export function usesMockAuth(): boolean {
  if (process.env.GRID_MOCK_AUTH === "1") return true;
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
