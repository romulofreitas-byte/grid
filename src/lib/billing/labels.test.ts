import { describe, expect, it } from "vitest";
import {
  ledgerReasonLabel,
  ledgerSign,
  orderStatusLabel,
  paymentMethodLabel,
} from "./labels";

describe("ledgerReasonLabel", () => {
  it("translates internês into Portuguese", () => {
    expect(ledgerReasonLabel("enrich")).toBe("Qualificação");
    expect(ledgerReasonLabel("export")).toBe("Exportação");
    expect(ledgerReasonLabel("grant_free_period")).toBe("Treino livre");
    expect(ledgerReasonLabel("plan_renew_reset")).toBe(
      "Créditos do plano zeraram no mês",
    );
    expect(ledgerReasonLabel("plan_piloto")).toBe("Créditos do plano");
    expect(ledgerReasonLabel("plan_renew_piloto_pro")).toBe("Créditos do plano");
    expect(ledgerReasonLabel("pack_100")).toBe("Recarga");
    expect(ledgerReasonLabel("ops_grant")).toBe("Ajuste da conta");
    expect(ledgerReasonLabel("ops_revoke")).toBe("Ajuste da conta");
    expect(ledgerReasonLabel("mystery_code")).toBe("Movimento");
  });
});

describe("orderStatusLabel", () => {
  it("translates invoice status", () => {
    expect(orderStatusLabel("paid")).toBe("Paga");
    expect(orderStatusLabel("pending")).toBe("Pendente");
    expect(orderStatusLabel("expired")).toBe("Expirada");
    expect(orderStatusLabel("failed")).toBe("Falhou");
    expect(orderStatusLabel("refunded")).toBe("Estornada");
  });
});

describe("paymentMethodLabel", () => {
  it("translates payment methods", () => {
    expect(paymentMethodLabel("pix")).toBe("Pix");
    expect(paymentMethodLabel("card_br")).toBe("Cartão");
    expect(paymentMethodLabel("boleto")).toBe("Boleto");
    expect(paymentMethodLabel("card_intl")).toBe("Cartão internacional");
    expect(paymentMethodLabel("platform")).toBe("Plataforma");
  });
});

describe("ledgerSign", () => {
  it("marks debit and expire as minus", () => {
    expect(ledgerSign("debit")).toBe("−");
    expect(ledgerSign("expire")).toBe("−");
    expect(ledgerSign("grant")).toBe("+");
    expect(ledgerSign("refund")).toBe("+");
  });
});
