import { describe, expect, it } from "vitest";
import { COPY } from "./copy";

describe("COPY login", () => {
  it("does not advertise passwordless or magic link", () => {
    const blob = [
      COPY.landingPrimeiraVez,
      COPY.loginConfirm,
      COPY.loginRecover,
      COPY.boxPlatformCoupon,
      COPY.boxPlatformTrialEnded,
      COPY.entrarSignupLane,
      COPY.entrarLoginLane,
      COPY.entrarTrialBadge,
      COPY.entrarTrialHint,
      COPY.entrarSignupHook,
      COPY.entrarLoginHook,
      COPY.entrarLoginCta,
    ].join(" ");
    expect(blob.toLowerCase()).not.toMatch(/sem senha/);
    expect(blob.toLowerCase()).not.toMatch(/magic/);
    expect(COPY.loginConfirm).toMatch(/caixa de entrada e o spam/);
  });

  it("gives signup a free-training badge and login a return hook", () => {
    expect(COPY.entrarSignupLane).toBe("Criar conta");
    expect(COPY.entrarLoginLane).toBe("Já tenho conta");
    expect(COPY.entrarTrialBadge).toBe("Treino livre");
    expect(COPY.entrarTrialHint).toMatch(/sem cartão/i);
    expect(COPY.entrarSignupHook).toMatch(/grátis/i);
    expect(COPY.entrarLoginHook).toMatch(/continue ligando/i);
    expect(COPY.entrarLoginCta).toBe("Entrar no Box");
  });
});

describe("COPY crm", () => {
  it("keeps the board in pista language, not generic SaaS jargon", () => {
    expect(COPY.crmNav).toBe("CRM");
    expect(COPY.crmTitle).toMatch(/pista/i);
    expect(COPY.crmHint).toMatch(/faixa/i);
    expect(COPY.crmNoActivity).toMatch(/volta/i);
    expect(COPY.crmNextAction).toMatch(/volta/i);
    expect(COPY.crmCadenceHint).toMatch(/faixa/i);
    expect(COPY.crmLogCallHint).toMatch(/encerra a volta/i);
    expect(COPY.crmScheduleHint).toMatch(/não registra/i);
    expect(COPY.crmSaveListToEnter).toMatch(/lista salva/i);
    expect(COPY.salvarNaPista).toBe("Salvar na pista");
    expect(COPY.listaDaVolta).toMatch(/lista/i);
  });
});
