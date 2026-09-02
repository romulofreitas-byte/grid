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

describe("COPY box cluster", () => {
  it("keeps hover phrases off the layout and interpolates counts", () => {
    expect(COPY.boxSequenciaHintZero).toMatch(/nenhuma sequência/i);
    expect(COPY.boxSequenciaHintOne).toMatch(/1 dia/);
    expect(COPY.boxSequenciaHintMany.replace("{n}", "4")).toBe(
      "Você está numa sequência de 4 dias fazendo ligações.",
    );
    expect(COPY.boxAcessoHint.replace("{n}", "900")).toBe(
      "Você ainda possui 900 créditos.",
    );
    expect(COPY.boxListasHintZero).toMatch(/não tem listas/i);
    expect(COPY.boxListasHintOne).toMatch(/1 lista salva/);
    expect(COPY.boxListasHintMany.replace("{n}", "4")).toBe(
      "Você possui 4 listas salvas.",
    );
  });
});

describe("COPY listas", () => {
  it("keeps list hints short and without grid jargon", () => {
    expect(COPY.listasSalvasHint.toLowerCase()).not.toMatch(/grid/);
    expect(COPY.listasNaoSalvasHint.toLowerCase()).not.toMatch(/grid|gerar/);
    expect(COPY.listasNaoSalvasHint).toMatch(/até 3 rascunhos/i);
    expect(COPY.listasMostrarMais.replace("{n}", "8")).toBe("Mostrar mais · 8");
  });
});

describe("COPY crm", () => {
  it("keeps the board in pista language, not generic SaaS jargon", () => {
    expect(COPY.crmNav).toBe("CRM");
    expect(COPY.crmTitle).toMatch(/pista/i);
    expect(COPY.crmHint).toMatch(/faixa/i);
    expect(COPY.crmNoActivity).toMatch(/volta/i);
    expect(COPY.crmNextAction).toMatch(/volta/i);
    expect(COPY.crmDeadlineLabel).toBe("Prazo");
    expect(COPY.crmTimeLabel).toBe("Horário");
    expect(COPY.crmWeekLater).toMatch(/semana/i);
    expect(COPY.crmCadenceHint).toMatch(/faixa/i);
    expect(COPY.crmScheduleHint).toMatch(/não registra/i);
    expect(COPY.crmHistoryTitle).toMatch(/histórico/i);
    expect(COPY.crmHistoryTodo).toMatch(/fazer/i);
    expect(COPY.crmMarkDone).toMatch(/concluir/i);
    expect(COPY.crmOpening).toMatch(/pista/i);
    expect(COPY.crmSaveListToEnter).toMatch(/lista salva/i);
    expect(COPY.salvarNaPista).toBe("Salvar na pista");
    expect(COPY.listaDaVolta).toMatch(/lista/i);
  });
});

describe("COPY landing", () => {
  const landingBlob = Object.entries(COPY)
    .filter(([key]) => key.startsWith("landing"))
    .map(([, value]) => value)
    .join(" ")
    .toLowerCase();

  it("keeps the home in lista, qualificação and CRM — no race jargon", () => {
    expect(landingBlob).not.toMatch(/capacete/);
    expect(landingBlob).not.toMatch(/\bpole\b/);
    expect(landingBlob).not.toMatch(/pista/);
    expect(landingBlob).not.toMatch(/voltas/);
    expect(COPY.landingHeadline).toMatch(/lista/i);
    expect(COPY.landingHeadline).toMatch(/decide/i);
    expect(COPY.landingHeadline).toMatch(/CRM/i);
    expect(COPY.landingPromessa).toMatch(/nicho/i);
    expect(COPY.landingPrimeiraVez).toMatch(/minutos/i);
    expect(COPY.landingCtaStart).toBe("Começar grátis");
    expect(COPY.landingSignedInCta).toBe("Abrir o GRID");
  });

  it("names the three commercial steps in plain language", () => {
    expect(COPY.landingHowStep1Title.toLowerCase()).toMatch(/nicho/);
    expect(COPY.landingHowStep2Title.toLowerCase()).toMatch(/lista/);
    expect(COPY.landingHowStep3Title.toLowerCase()).toMatch(/crm/);
    expect(COPY.landingPain1Title.toLowerCase()).toMatch(/lista/);
    expect(COPY.landingPain2Title.toLowerCase()).toMatch(/decide/);
    expect(COPY.landingPain3Title.toLowerCase()).toMatch(/digital/);
  });
});

describe("COPY empresas", () => {
  it("keeps the search field open without format instructions", () => {
    expect(COPY.empresasPlaceholder.toLowerCase()).toMatch(/nome/);
    expect(COPY.empresasPlaceholder.toLowerCase()).toMatch(/fantasia/);
    expect(COPY.empresasPlaceholder.toLowerCase()).toMatch(/cnpj/);
    expect(COPY.empresasPlaceholder).not.toMatch(/00\.000/);
    expect(COPY.empresasMinChars.toLowerCase()).toMatch(/cnpj/);
  });
});
