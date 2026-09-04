import { describe, expect, it } from "vitest";
import { COPY } from "./copy";

describe("COPY login", () => {
  it("publishes PILOTO for active platform subscribers", () => {
    expect(COPY.boxPlatformCoupon).toMatch(/PILOTO/);
    expect(COPY.boxPlatformCoupon).toMatch(/assinantes ativos da[\s\u00a0]Plataforma/);
  });

  it("does not advertise passwordless or magic link", () => {
    const blob = [
      COPY.landingPrimeiraVez,
      COPY.loginConfirm,
      COPY.loginRecover,
      COPY.boxPlatformCoupon,
      COPY.boxPlatformTrialEnded,
      COPY.entrarSignupLane,
      COPY.entrarLoginLane,
      COPY.entrarToggleLogin,
      COPY.entrarToggleSignup,
      COPY.entrarTrialBadge,
      COPY.entrarTrialHint,
      COPY.entrarSignupHook,
      COPY.entrarLoginHook,
      COPY.entrarLoginCta,
      COPY.entrarGoogleCta,
      COPY.entrarOrDivider,
    ].join(" ");
    expect(blob.toLowerCase()).not.toMatch(/sem senha/);
    expect(blob.toLowerCase()).not.toMatch(/magic/);
    expect(COPY.loginConfirm).toMatch(/caixa de entrada e o spam/);
  });

  it("gives signup a free-training badge and login a return hook", () => {
    expect(COPY.entrarSignupLane).toBe("Criar conta");
    expect(COPY.entrarLoginLane).toBe("Já tenho conta");
    expect(COPY.entrarToggleLogin).toBe("Entrar");
    expect(COPY.entrarToggleSignup).toBe("Criar conta");
    expect(COPY.entrarTrialBadge).toBe("Treino livre");
    expect(COPY.entrarTrialHint).toMatch(/sem[\s\u00a0]cartão/i);
    expect(COPY.entrarSignupHook).toMatch(/grátis/i);
    expect(COPY.entrarSignupHook).toMatch(/25[\s\u00a0]qualifica/i);
    expect(COPY.entrarSignupHook).toMatch(/sem[\s\u00a0]cartão/i);
    expect(COPY.entrarLoginHook).toMatch(/continuar a lista/i);
    expect(COPY.entrarLoginCta).toBe("Entrar no GRID");
    expect(COPY.entrarGoogleCta).toBe("Continuar com Google");
    expect(COPY.entrarOrDivider).toBe("ou");
  });
});

describe("COPY box cluster", () => {
  it("keeps hover phrases off the layout and interpolates counts", () => {
    expect(COPY.boxSequenciaHintZero).toMatch(/nenhuma sequência/i);
    expect(COPY.boxSequenciaHintOne).toMatch(/1 dia/);
    expect(COPY.boxSequenciaHintMany.replace("{n}", "4")).toBe(
      "Você está numa sequência de 4 dias fazendo ligações.",
    );
    expect(COPY.boxAcessoHint).toMatch(/de meta/);
    expect(COPY.boxAcessoHintLocked).toMatch(/não reabre/i);
    expect(
      COPY.boxAcessoHint
        .replace("{days}", "18")
        .replace("{dayWord}", "dias")
        .replace("{goal}", "20")
        .replace("{credits}", "900")
        .replace("{cost}", "1"),
    ).toBe(
      "Seu saldo cobre 18 dias de meta (20 fichas por dia). 900 créditos · 1 por ficha.",
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

const AUTHENTICATED_COPY = Object.entries(COPY)
  .filter(([key]) => !key.startsWith("landing"))
  .map(([, value]) => value)
  .join(" ");

describe("COPY crm", () => {
  it("keeps the board in plain CRM language, not race jargon", () => {
    expect(COPY.crmNav).toBe("CRM");
    expect(COPY.crmTitle).toBe("CRM");
    expect(COPY.crmHint.toLowerCase()).not.toMatch(/pista|\bvolta\b/);
    expect(COPY.crmNoActivity).toBe("Sem próxima ação");
    expect(COPY.crmNextAction).toBe("Próxima ação");
    expect(COPY.crmDeadlineLabel).toBe("Prazo");
    expect(COPY.crmTimeLabel).toBe("Horário");
    expect(COPY.crmWeekLater).toMatch(/semana/i);
    expect(COPY.crmCadenceHint).toMatch(/etapa/i);
    expect(COPY.crmScheduleHint).toMatch(/não registra/i);
    expect(COPY.crmHistoryTitle).toMatch(/histórico/i);
    expect(COPY.crmHistoryTodo).toMatch(/fazer/i);
    expect(COPY.crmMarkDone).toMatch(/concluir/i);
    expect(COPY.crmOpening).toMatch(/CRM/);
    expect(COPY.crmSaveListToEnter).toMatch(/salve a lista/i);
    expect(COPY.salvarNaPista).toBe("Salvar no CRM");
    expect(COPY.listaDaVolta).toMatch(/lista/i);
  });
});

describe("COPY authenticated app", () => {
  it("drops race jargon from body copy", () => {
    expect(AUTHENTICATED_COPY.toLowerCase()).not.toMatch(/pista/);
    expect(AUTHENTICATED_COPY.toLowerCase()).not.toMatch(/capacete/);
    expect(COPY.crmNextAction.toLowerCase()).not.toMatch(/volta/);
    expect(COPY.crmNoActivity.toLowerCase()).not.toMatch(/volta/);
    expect(COPY.boxSemLista.toLowerCase()).not.toMatch(/volta/);
    expect(AUTHENTICATED_COPY.toLowerCase()).not.toMatch(/score seco/);
    expect(COPY.boxPistaFechada).toBe("Sem lista salva");
    expect(COPY.qualificarFichaLead.toLowerCase()).toMatch(/site/);
    expect(COPY.qualificarFichaLead.toLowerCase()).not.toMatch(/cruzar/);
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

  it("sells missing digital assets as an approach hook", () => {
    expect(COPY.landingQualifyBody.toLowerCase()).toMatch(/falta/);
    expect(COPY.landingQualifyBody.toLowerCase()).toMatch(/abordagem/);
    expect(COPY.landingQualifyBody.toLowerCase()).toMatch(/oportunidade/);
    expect(COPY.landingQualifyOpportunity).toBe("Oportunidade");
    expect(COPY.landingQualifyMissingSeal).toBe("Não possui");
  });
});

describe("COPY empresas", () => {
  it("keeps the search field open without format instructions", () => {
    expect(COPY.empresasPlaceholder.toLowerCase()).toMatch(/nome/);
    expect(COPY.empresasPlaceholder.toLowerCase()).toMatch(/fantasia/);
    expect(COPY.empresasPlaceholder.toLowerCase()).toMatch(/cnpj/);
    expect(COPY.empresasPlaceholder).not.toMatch(/00\.000/);
    expect(COPY.empresasMinChars.toLowerCase()).toMatch(/cnpj/);
    expect(COPY.empresasListaCta).toMatch(/\{nicho\}/);
    expect(COPY.empresasListaHint.toLowerCase()).toMatch(/atividade/);
  });
});
