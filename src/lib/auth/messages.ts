import type { EmailOtpType } from "@supabase/supabase-js";
import { COPY } from "@/lib/copy";

export function isDuplicateSignupUser(
  user: { identities?: unknown[] | null } | null | undefined,
): boolean {
  if (!user) return false;
  return !Array.isArray(user.identities) || user.identities.length === 0;
}

export function loginConfirmNotice(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return COPY.loginConfirm;
  return `Enviamos um link para ${trimmed}. Olhe a caixa de entrada e o spam. Se o endereço estiver errado, volte e crie a conta de novo. Se já tem conta, entre.`;
}

export function loginErrorMessage(raw: string | undefined): string {
  const msg = (raw ?? "").toLowerCase();
  if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
    return "Confirme o e-mail antes de entrar. Olhe a caixa de entrada e o spam.";
  }
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "E-mail ou senha incorretos. Se você entrou pelo link do e-mail, use Esqueci a senha.";
  }
  return "Não foi possível entrar";
}

export function signupErrorMessage(raw: string | undefined): string {
  const msg = (raw ?? "").toLowerCase();
  if (
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("user already")
  ) {
    return "Este e-mail já tem conta. Entre ou recupere a senha.";
  }
  if (msg.includes("password") && msg.includes("least")) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }
  return "Não foi possível criar a conta";
}

export function callbackErrorQuery(
  message: string,
): "expired" | "used" | "session" {
  const msg = message.toLowerCase();
  if (msg.includes("expired") || msg.includes("otp_expired")) return "expired";
  if (
    msg.includes("already been used") ||
    (msg.includes("invalid") && (msg.includes("otp") || msg.includes("token")))
  ) {
    return "used";
  }
  return "session";
}

export function entrarNoticeForError(code: string | null): string | null {
  if (code === "expired") return "Este link expirou. Peça um novo.";
  if (code === "used") {
    return "Este link já foi usado ou não é mais válido.";
  }
  if (code === "config") return "Auth não configurado.";
  if (code) return "Não foi possível concluir o acesso. Tente de novo.";
  return null;
}

export function postVerifyPath(type: EmailOtpType, next: string): string {
  if (type === "recovery") return "/entrar?definir=1";
  return next;
}
