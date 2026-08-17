import { createClient } from "@/lib/supabase/server";
import { LOCAL_USER_ID } from "@/lib/data/pg";
import { usesMockAuth } from "@/lib/auth/mock";

export { usesMockAuth };

export async function requireSession(): Promise<{ id: string; email: string | null } | null> {
  if (usesMockAuth()) {
    return { id: LOCAL_USER_ID, email: "piloto@mundopodium.com.br" };
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
