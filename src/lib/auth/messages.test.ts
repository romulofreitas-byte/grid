import { describe, expect, it } from "vitest";
import {
  authCatchMessage,
  callbackErrorQuery,
  entrarNoticeForError,
  isDuplicateSignupUser,
  loginConfirmNotice,
  loginErrorMessage,
  oauthErrorMessage,
  passwordUpdateErrorMessage,
  postVerifyPath,
  signupErrorMessage,
} from "./messages";

describe("loginErrorMessage", () => {
  it("asks to confirm when email is not confirmed", () => {
    expect(loginErrorMessage("Email not confirmed")).toMatch(/caixa de entrada/);
  });

  it("hides whether the email exists and points old magic-link users to recovery", () => {
    expect(loginErrorMessage("Invalid login credentials")).toMatch(
      /Esqueci a senha/,
    );
  });

  it("maps rate limits", () => {
    expect(loginErrorMessage("over_request_rate_limit")).toMatch(/Muitas tentativas/);
  });
});

describe("isDuplicateSignupUser", () => {
  it("treats empty identities as an existing account", () => {
    expect(isDuplicateSignupUser({ identities: [] })).toBe(true);
    expect(isDuplicateSignupUser({ identities: null })).toBe(true);
    expect(isDuplicateSignupUser({ identities: [{ id: "1" }] })).toBe(false);
    expect(isDuplicateSignupUser(null)).toBe(false);
  });
});

describe("loginConfirmNotice", () => {
  it("cites the address and does not ask to guess the email", () => {
    expect(loginConfirmNotice("ada@grid.dev")).toMatch(/ada@grid.dev/);
    expect(loginConfirmNotice("ada@grid.dev")).toMatch(/caixa de entrada/);
    expect(loginConfirmNotice("")).toMatch(/caixa de entrada/);
  });
});

describe("signupErrorMessage", () => {
  it("sends existing users to login or recovery", () => {
    expect(signupErrorMessage("User already registered")).toMatch(
      /já tem conta/,
    );
  });

  it("does not use login wording on a generic failure", () => {
    expect(signupErrorMessage("unexpected")).toBe("Não foi possível criar a conta");
    expect(signupErrorMessage("unexpected")).not.toMatch(/entrar/);
  });
});

describe("authCatchMessage", () => {
  it("keeps signup failures off the login phrase", () => {
    expect(authCatchMessage("signup")).toBe("Não foi possível criar a conta");
    expect(authCatchMessage("login")).toBe("Não foi possível entrar");
    expect(authCatchMessage("recover")).toMatch(/recuperação/);
    expect(authCatchMessage("password")).toMatch(/senha/);
  });
});

describe("oauthErrorMessage", () => {
  it("stays in Portuguese", () => {
    expect(oauthErrorMessage("Unable to exchange oauth code")).toMatch(/Google/);
    expect(oauthErrorMessage("Unable to exchange oauth code")).not.toMatch(/Unable/);
  });
});

describe("passwordUpdateErrorMessage", () => {
  it("stays in Portuguese", () => {
    expect(passwordUpdateErrorMessage("New password should be different")).toMatch(
      /diferente/,
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
