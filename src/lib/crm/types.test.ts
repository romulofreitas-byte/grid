import { describe, expect, it } from "vitest";
import {
  channelForCategory,
  formChannelLabel,
  matchesAutomacoesCategory,
} from "./types";

describe("formChannelLabel", () => {
  it("keeps ads with webhook, not anúncio Meta", () => {
    expect(formChannelLabel("meta")).toBe("anúncio Meta");
    expect(formChannelLabel("ads")).toBe("webhook");
    expect(formChannelLabel("webhook")).toBe("webhook");
    expect(formChannelLabel("site")).toBe("link no site");
  });
});

describe("automacoes categories", () => {
  it("maps each category to a create channel and list filter", () => {
    expect(channelForCategory("captar")).toBe("site");
    expect(channelForCategory("avancado")).toBe("webhook");
    expect(channelForCategory("meta")).toBe("meta");
    expect(matchesAutomacoesCategory("site", "captar")).toBe(true);
    expect(matchesAutomacoesCategory("webhook", "captar")).toBe(false);
    expect(matchesAutomacoesCategory("webhook", "avancado")).toBe(true);
    expect(matchesAutomacoesCategory("ads", "avancado")).toBe(true);
    expect(matchesAutomacoesCategory("meta", "avancado")).toBe(false);
    expect(matchesAutomacoesCategory("meta", "meta")).toBe(true);
    expect(matchesAutomacoesCategory("ads", "meta")).toBe(false);
  });
});
