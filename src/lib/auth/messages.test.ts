import { describe, expect, it } from "vitest";
import {
  callbackErrorQuery,
  entrarNoticeForError,
  loginErrorMessage,
  postVerifyPath,
  signupErrorMessage,
} from "./messages";

describe("loginErrorMessage", () => {
  it("asks to confirm when email is not confirmed", () => {
    expect(loginErrorMessage("Email not confirmed")).toMatch(/Confirme o e-mail/);
  });

  it("hides whether the email exists and points old magic-link users to recovery", () => {
    expect(loginErrorMessage("Invalid login credentials")).toMatch(
      /Esqueci a senha/,
    );
  });
});

describe("signupErrorMessage", () => {
  it("sends existing users to login or recovery", () => {
    expect(signupErrorMessage("User already registered")).toMatch(
      /já tem conta/,
    );
  });
});

describe("callbackErrorQuery", () => {
  it("maps expired and used links", () => {
    expect(callbackErrorQuery("otp_expired: Token has expired")).toBe("expired");
    expect(callbackErrorQuery("Token has expired or is invalid")).toBe(
      "expired",
    );
    expect(callbackErrorQuery("Email link is invalid or has expired")).toBe(
      "expired",
    );
    expect(callbackErrorQuery("Token has already been used")).toBe("used");
    expect(callbackErrorQuery("invalid otp")).toBe("used");
    expect(callbackErrorQuery("something else")).toBe("session");
  });
});

describe("entrarNoticeForError", () => {
  it("explains expired used config and generic session errors", () => {
    expect(entrarNoticeForError("expired")).toMatch(/expirou/);
    expect(entrarNoticeForError("used")).toMatch(/já foi usado/);
    expect(entrarNoticeForError("config")).toMatch(/não configurado/i);
    expect(entrarNoticeForError("session")).toMatch(/Não foi possível concluir/);
    expect(entrarNoticeForError(null)).toBeNull();
  });
});

describe("postVerifyPath", () => {
  it("sends recovery to the password form and keeps other nexts", () => {
    expect(postVerifyPath("recovery", "/box")).toBe("/entrar?definir=1");
    expect(postVerifyPath("signup", "/entrar?go=1")).toBe("/entrar?go=1");
    expect(postVerifyPath("magiclink", "/pagar?sku=piloto")).toBe(
      "/pagar?sku=piloto",
    );
  });
});
