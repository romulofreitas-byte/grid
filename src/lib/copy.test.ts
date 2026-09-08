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
      COPY.entrarEmailCta,
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
    expect(COPY.entrarEmailCta).toBe("Usar e-mail");
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
    expect(COPY.boxSprintEmptyHasCrm).toMatch(/só executa ligar e WhatsApp/i);
    expect(COPY.crmScheduleHintFollowup).toMatch(/não entra no Box/i);
  });
});

describe("COPY export cost", () => {
  it("states the debit in credits and interpolates counts", () => {
    expect(COPY.exportCostEyebrow.toLowerCase()).toMatch(/custosa/);
    expect(COPY.exportCostDebit.replace("{credits}", "500 créditos")).toBe(
      "Vai debitar 500 créditos.",
    );
    expect(COPY.exportCostBadgeQualifiedMany.replace("{n}", "11")).toBe(
      "11 qualificadas",
    );
    expect(
      COPY.exportCostBadgeBalance.replace("{credits}", "843 créditos"),
    ).toBe("843 créditos no saldo");
    expect(COPY.exportCostCrmBadge.toLowerCase()).toMatch(/crm/);
    expect(COPY.exportCostCrmHint.toLowerCase()).toMatch(/quadro/);
    expect(COPY.exportCostNothing.toLowerCase()).toMatch(/nada a debitar/);
    expect(COPY.exportCostTitleExport.replace("{format}", "Excel")).toBe(
      "Exportar Excel",
    );
    expect(COPY.exportCostTitlePush).toBe("Enviar lista");
  });
});

describe("COPY importações", () => {
  it("states last-run status and the fix path without race jargon", () => {
    expect(COPY.importacoesHistoryTitle).toBe("Última importação");
    expect(COPY.importacoesHistoryShowMore).toMatch(/\{n\}/);
    expect(COPY.importacoesStatusPartial).toBe("Com erros");
    expect(COPY.importacoesDownloadErrors.toLowerCase()).toMatch(/erro/);
    expect(COPY.importacoesFixHint.toLowerCase()).toMatch(/quadro/);
    expect(COPY.importacoesIssueEmptyTitle.toLowerCase()).toMatch(/dados/);
    expect(COPY.importacoesFixesCnpjBlocked.toLowerCase()).toMatch(/cnpj/);
    expect(COPY.importacoesFixesCnpjBlocked.toLowerCase()).toMatch(/mesmo assim/);
    expect(COPY.importacoesSendFixes).toBe("Enviar correções");
    expect(COPY.importacoesSendFixesMany).toMatch(/\{n\}/);
    expect(COPY.importacoesSendAnyway.toLowerCase()).toMatch(/mesmo assim/);
    expect(COPY.importacoesPanelFixPointerOne.toLowerCase()).toMatch(/abaixo/);
    expect(COPY.importacoesIssueCnpjAction.toLowerCase()).toMatch(/mesmo assim/);
    expect(COPY.importacoesSkippedHint.toLowerCase()).toMatch(/não é erro/);
    expect(COPY.importacoesBadgeCreatedMany.replace("{n}", "11")).toBe("11 no CRM");
    expect(COPY.importacoesLead).toMatch(/quadro/);
    expect(COPY.importacoesImportAndQualify).toMatch(/\{max\}/);
    expect(COPY.importacoesImportAndQualifyHint).toMatch(/\{max\}/);
    expect(COPY.importacoesIgnoreErrors).toBe("Ignorar");
    expect(COPY.importacoesNeedNicheName.toLowerCase()).toMatch(/nicho/);
    expect(COPY.importacoesTimeout.toLowerCase()).toMatch(/demorou/);
  });
});

describe("COPY automações", () => {
  it("names inbound delivery status without race jargon", () => {
    expect(COPY.automacoesEventsTitle).toBe("Últimos envios");
    expect(COPY.automacoesLastCreated).toBe("Entrou");
    expect(COPY.automacoesLastSkipped).toBe("Já no quadro");
    expect(COPY.automacoesLastError).toBe("Recusado");
    expect(COPY.automacoesEventsHint.toLowerCase()).toMatch(/token/);
  });
});

describe("COPY listas", () => {
  it("keeps list hints short and without grid jargon", () => {
    expect(COPY.listasSalvasHint.toLowerCase()).not.toMatch(/grid/);
    expect(COPY.listasNaoSalvasHint.toLowerCase()).not.toMatch(/grid|gerar/);
    expect(COPY.listasNaoSalvasHint).toMatch(/até 3 rascunhos/i);
    expect(COPY.listasMostrarMais.replace("{n}", "8")).toBe("Mostrar mais · 8");
    expect(COPY.listasVolumeLabel).toBe("pra ligar");
    expect(COPY.listasVolumeAria.replace("{n}", "1.234")).toBe(
      "1.234 empresas salvas para ligar. Escolha uma lista.",
    );
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
    expect(COPY.crmCadenceHint).toMatch(/nicho/i);
    expect(COPY.crmCadenceHint).toMatch(/outras pipelines/i);
    expect(COPY.crmDeletePipelineNeedTransfer).toMatch(/transfira/i);
    expect(COPY.crmTransferPipeline).toMatch(/nicho/i);
    expect(COPY.crmDeleteListEntradaHint).toMatch(/qualificação permanece/i);
    expect(COPY.crmScheduleHint).toMatch(/não substitui/i);
    expect(COPY.crmScheduleHintFollowup).toMatch(/não entra no Box/i);
    expect(COPY.crmLogCallHint).toMatch(/não mexe/i);
    expect(COPY.crmScheduleDesktop).toBe("Agendar próxima ação");
    expect(COPY.crmLogCallDesktop).toBe("Registrar no histórico");
    expect(COPY.confirmEyebrow).toBe("Confirmar");
    expect(COPY.confirmCancel).toBe("Cancelar");
    expect(COPY.callAskConfirm).toBe("Ligar");
    expect(COPY.callAskCancel).toBe("Cancelar");
    expect(COPY.callAskTitle).toMatch(/ligar/i);
    expect(COPY.callDialHint).toMatch(/confirme/i);
    expect(COPY.gridCalledToday).toBe("Ligou");
    expect(COPY.crmHistoryTitle).toMatch(/histórico/i);
    expect(COPY.crmAssetsTitle).toBe("Ativos");
    expect(COPY.crmHistoryTodo).toMatch(/fazer/i);
    expect(COPY.crmMarkDone).toMatch(/concluir/i);
    expect(COPY.boxSprintTitle).toMatch(/trabalho do dia/i);
    expect(COPY.boxNow).toMatch(/agora/i);
    expect(COPY.boxOpening).toMatch(/ligar/i);
    expect(COPY.boxQueue).toMatch(/fila/i);
    expect(COPY.boxOverdue).toMatch(/atrasado/i);
    expect(COPY.boxOverdueChip).toBe("Atrasado");
    expect(COPY.boxRhythmCalls).toMatch(/ligações/i);
    expect(COPY.painelOpenBox).toMatch(/box/i);
    expect(COPY.crmOpening).toMatch(/CRM/);
    expect(COPY.crmSaveListToEnter).toMatch(/salve a lista/i);
    expect(COPY.crmBridgeFailed).toMatch(/não foi possível colocar no crm/i);
    expect(COPY.crmBridgePartial).toMatch(/não entraram no crm/i);
    expect(COPY.lockedLightsReplay).toMatch(/luzes/i);
    expect(COPY.lockedHighlightHint).toMatch(/pro/i);
    expect(COPY.marketMunitionCta).toMatch(/pro/i);
    expect(COPY.marketDorCaixa).toMatch(/caixa/i);
    expect(COPY.marketChipCaixa).toBe("Caixa");
    expect(COPY.marketChipDono).toBe("Dono");
    expect(COPY.marketChipLingua).toBe("Língua");
    expect(COPY.salvarNaPista).toBe("Salvar no CRM");
    expect(COPY.listaDaVolta).toMatch(/lista/i);
  });
});

describe("COPY setup and conta", () => {
  it("asks ritual questions and then sends the person to generate a list", () => {
    expect(COPY.setupIdentityTitle).toBe("Vamos começar");
    expect(COPY.setupStepName).toMatch(/como te chamo/i);
    expect(COPY.setupStepMarket).toMatch(/mercado/);
    expect(COPY.setupStepCargo).toMatch(/papel/);
    expect(COPY.setupStepPhoto).toMatch(/piloto/);
    expect(COPY.setupStepPhoto.toLowerCase()).not.toMatch(/opcional/);
    expect(COPY.setupBadgePhoto).toBe("Foto");
    expect(COPY.setupCta).toBe("Começar a gerar lista");
    expect(COPY.setupNeedIdentity).toMatch(/mercado/);
    expect(COPY.setupNeedIdentity).toMatch(/cargo/);
    expect(COPY.setupIdentityHint.toLowerCase()).not.toMatch(/primeira lista/);
    expect(COPY.contaExtrato).toBe("Extrato");
    expect(COPY.contaCreditHint).toMatch(/1 crédito = 1 qualificação/);
    expect(COPY.contaIdentityHint.toLowerCase()).toMatch(/documento/);
    expect(COPY.contaWhatsApp24h.toLowerCase()).toMatch(/agente automático/);
    expect(COPY.contaWhatsApp24h.toLowerCase()).toMatch(/24 horas/);
  });
});

describe("COPY authenticated app", () => {
  it("drops race jargon from body copy", () => {
    expect(AUTHENTICATED_COPY.toLowerCase()).not.toMatch(/pista/);
    expect(AUTHENTICATED_COPY.toLowerCase()).not.toMatch(/capacete/);
    expect(COPY.crmNextAction.toLowerCase()).not.toMatch(/volta/);
    expect(COPY.crmNoActivity.toLowerCase()).not.toMatch(/volta/);
    expect(COPY.boxSemLista.toLowerCase()).not.toMatch(/volta/);
    expect(AUTHENTICATED_COPY.toLowerCase()).not.toMatch(/\banel\b/);
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
    expect(COPY.landingNavTour).toBe("Ver o tour");
    expect(COPY.landingHowTourCta).toMatch(/tour/i);
  });

  it("names the three commercial steps in plain language", () => {
    expect(COPY.landingHowStep1Title.toLowerCase()).toMatch(/nicho/);
    expect(COPY.landingHowStep2Title.toLowerCase()).toMatch(/lista/);
    expect(COPY.landingHowStep3Title.toLowerCase()).toMatch(/crm/);
    expect(COPY.landingPain1Title.toLowerCase()).toMatch(/lista/);
    expect(COPY.landingPain2Title.toLowerCase()).toMatch(/decide/);
    expect(COPY.landingPain3Title.toLowerCase()).toMatch(/digital/);
  });

  it("ladders plans from Treino to Pro without putting automations on Piloto", () => {
    expect(COPY.landingPlansBody).toMatch(/Treino livre/);
    expect(COPY.landingPlansBody).toMatch(/Piloto libera o CRM/);
    expect(COPY.landingPlansBody).toMatch(/importar a planilha/);
    expect(COPY.landingPlansBody).toMatch(/Automações/);
    expect(COPY.landingPlansBody).not.toMatch(/export/i);
    expect(COPY.landingPlansShowAll).toBe("Ver tudo");
    expect(COPY.landingPlansShowLess).toBe("Ver menos");
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

describe("COPY tour", () => {
  it("guides Painel then lista without race jargon", () => {
    expect(COPY.tourNext).toBe("Próximo");
    expect(COPY.tourSkip).toBe("Pular");
    expect(COPY.tourFinishApp).toMatch(/Painel/);
    expect(COPY.tourFinishLanding).toBe("Começar grátis");
    expect(COPY.tourReplay.toLowerCase()).toMatch(/de novo/);
    expect(COPY.tourReplayHint.toLowerCase()).toMatch(/painel/);
    expect(COPY.tourStepPainelWelcomeTitle.toLowerCase()).toMatch(/painel/);
    expect(COPY.tourStepGridOrderBody.toLowerCase()).toMatch(/p1/);
    expect(COPY.tourStepGridSaveTitle.toLowerCase()).toMatch(/crm/);
    const blob = [
      COPY.tourStepPainelWelcomeBody,
      COPY.tourStepPainelGoalBody,
      COPY.tourStepPainelCallBody,
      COPY.tourStepPainelNewListBody,
      COPY.tourStepGridOrderBody,
      COPY.tourStepGridRowBody,
      COPY.tourStepGridQualifyBody,
      COPY.tourStepGridSaveBody,
    ]
      .join(" ")
      .toLowerCase();
    expect(blob).not.toMatch(/pista/);
    expect(blob).not.toMatch(/capacete/);
    expect(blob).not.toMatch(/\banel\b/);
  });
});

describe("COPY crm add deal", () => {
  it("nudges qualification before the company enters the board", () => {
    expect(COPY.crmPullFicha).toBe("Puxar ficha");
    expect(COPY.crmOnGrid).toBe("No CRM");
    expect(COPY.crmPullFichaHint).toBe(
      "Qualifique agora para conferir os dados certos antes de mandar ao quadro. Custa 1 crédito.",
    );
    expect(COPY.crmNewPipeline).toBe("Novo nicho");
    expect(COPY.crmAddDealNeedPipeline.toLowerCase()).toMatch(/nicho/);
    expect(COPY.crmImport).toBe("Importar");
  });
});

describe("COPY crm grid attach", () => {
  it("names the two-step search then qualify strip", () => {
    expect(COPY.crmSearchGrid).toBe("Procurar no Grid");
    expect(COPY.crmQualifyGrid).toBe("Qualificar no Grid");
    expect(COPY.crmAttachStepSearch).toBe("Procurar");
    expect(COPY.crmAttachStepQualify).toBe("Qualificar");
    expect(COPY.crmSearchGridSkip).toBe("Deixar sem CNPJ");
    expect(COPY.crmSearchGridEmpty).toMatch(/homônimo/);
  });
});

describe("COPY ficha maps", () => {
  it("keeps Maps confirm labels short", () => {
    expect(COPY.fichaMapsConfirmThis).toBe("É este");
    expect(COPY.fichaMapsRejectThis).toBe("Não é");
    expect(COPY.inserirQualificacao).toBe("Inserir");
    expect(COPY.fichaMapsConfirmHint.length).toBeLessThan(40);
    expect(COPY.fichaMapsOpenSearch).toMatch(/busca/i);
    expect(COPY.fichaGmbHumanPin).toBe("Você confirmou este pin.");
    expect(COPY.fichaGmbHumanPin.toLowerCase()).not.toMatch(/receita/);
    expect(COPY.fichaGmbCardUnread).toMatch(/não li o card/i);
  });
});

describe("COPY focus mode", () => {
  it("names the chip toggle and the desktop badge", () => {
    expect(COPY.focusEnter).toBe("Entrar no modo Focus");
    expect(COPY.focusExit).toBe("Sair do modo Focus");
    expect(COPY.focusBadgeEyebrow).toBe("Focus");
    expect(COPY.focusBadgeOn).toBe("Ligado");
    expect(COPY.focusSprintDone).toBe("Sprint ok");
    expect(COPY.focusEnter.toLowerCase()).toMatch(/focus/);
  });
});
