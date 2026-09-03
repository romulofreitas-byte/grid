import type { EmailOtpType } from "@supabase/supabase-js";
import type { AuthAction } from "@/lib/auth/actions";
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
  return `Enviamos um link para ${trimmed}. Veja a caixa de entrada e o spam. Se o endereço estiver errado, volte e cadastre de novo. Se você já tem conta, entre.`;
}

function isRateLimited(msg: string): boolean {
  return (
    msg.includes("rate limit") ||
    msg.includes("too many") ||
    msg.includes("over_request")
  );
}

export function loginErrorMessage(raw: string | undefined): string {
  const msg = (raw ?? "").toLowerCase();
  if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
    return "Confirme o e-mail antes de entrar. Olhe a caixa de entrada e o spam.";
  }
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "E-mail ou senha incorretos. Se você entrou pelo link do e-mail, use Esqueci a senha.";
  }
  if (isRateLimited(msg)) {
    return "Muitas tentativas. Espere um pouco e tente de novo.";
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
  if (msg.includes("signup") && msg.includes("disabled")) {
    return "Cadastro temporariamente indisponível. Tente de novo em instantes.";
  }
  if (isRateLimited(msg)) {
    return "Muitas tentativas. Espere um pouco e tente de novo.";
  }
  return "Não foi possível criar a conta";
}

export function oauthErrorMessage(raw: string | undefined): string {
  const msg = (raw ?? "").toLowerCase();
  if (isRateLimited(msg)) {
    return "Muitas tentativas. Espere um pouco e tente de novo.";
  }
  if (msg.includes("provider") || msg.includes("oauth")) {
    return "Não foi possível entrar com o Google. Tente e-mail e senha.";
  }
  return "Não foi possível entrar com o Google";
}

export function passwordUpdateErrorMessage(raw: string | undefined): string {
  const msg = (raw ?? "").toLowerCase();
  if (msg.includes("password") && msg.includes("least")) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }
  if (msg.includes("same") || msg.includes("should be different")) {
    return "Escolha uma senha diferente da atual.";
  }
  return "Não foi possível salvar a senha";
}

export function authCatchMessage(action: AuthAction | null): string {
  if (action === "signup") return "Não foi possível criar a conta";
  if (action === "recover") return "Não foi possível enviar o e-mail de recuperação";
  if (action === "resend") return "Não foi possível reenviar";
  if (action === "password") return "Não foi possível salvar a senha";
  if (action === "google") return "Não foi possível entrar com o Google";
  if (action === "logout") return "Não foi possível sair";
  return "Não foi possível entrar";
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
  if (code === "config") return "O acesso não está configurado. Tente de novo em instantes.";
  if (code) return "Não foi possível concluir o acesso. Tente de novo.";
  return null;
}

export function postVerifyPath(type: EmailOtpType, next: string): string {
  if (type === "recovery") return "/entrar?definir=1";
  return next;
}
