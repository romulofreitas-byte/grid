export const AUTH_ACTIONS = [
  "login",
  "signup",
  "recover",
  "resend",
  "google",
  "password",
] as const;

export type AuthAction = (typeof AUTH_ACTIONS)[number];

export function parseAuthAction(body: {
  action?: unknown;
  provider?: unknown;
}): AuthAction | null {
  if (body.provider === "google" || body.action === "google") return "google";
  if (
    body.action === "login" ||
    body.action === "signup" ||
    body.action === "recover" ||
    body.action === "resend" ||
    body.action === "password"
  ) {
    return body.action;
  }
  return null;
}
