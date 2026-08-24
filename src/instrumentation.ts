export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProdEnv } = await import("@/lib/env/deploy");
  assertProdEnv();
}
