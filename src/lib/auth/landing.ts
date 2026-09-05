import { getRepo } from "@/lib/data";
import { authLandingPath } from "@/lib/auth/next-path";

export async function resolveAuthLanding(
  userId: string,
  dest: string,
): Promise<string> {
  try {
    const profile = await getRepo().getProfile(userId);
    return authLandingPath(dest, Boolean(profile.onboarding_completed_at));
  } catch {
    return authLandingPath(dest, false);
  }
}
