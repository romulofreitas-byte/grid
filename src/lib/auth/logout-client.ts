import { CATCHUP_SESSION_KEY } from "@/lib/catchup/constants";

export function clearLocalSession() {
  try {
    localStorage.removeItem("grid_mock_session");
    sessionStorage.removeItem(CATCHUP_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export async function logoutPilot() {
  try {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
  } catch {
    /* still leave */
  }
  clearLocalSession();
  window.location.assign("/entrar");
}
