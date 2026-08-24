import { describe, expect, it } from "vitest";
import {
  extractContacts,
  extractNormalizedPhones,
  extractSiteBrand,
  harvestMarkupFromAssetText,
  isSpaShell,
  listSpaScriptUrls,
  normalizeSocialUrl,
  phoneInAgencyFooter,
} from "./extract";

const HTML = `<!doctype html>
<html>
<body>
  <main>
    <p>Fale conosco</p>
    <a href="tel:+553133331111">(31) 3333-1111</a>
  </main>
  <footer>
    <p>© 2024 Empresa XYZ</p>
    <div class="credits">
      desenvolvido por Agência Web Design
      <a href="tel:+553198887777">(31) 98887-7777</a>
    </div>
  </footer>
</body>
</html>`;

describe("extractContacts agency footer", () => {
  it("keeps the company tel: link and discards the agency number", () => {
    const phones = extractNormalizedPhones(HTML, "31");
    const e164s = phones.map((p) => p.e164);
    expect(e164s).toContain("+553133331111");
    expect(e164s).not.toContain("+553198887777");
  });

  it("flags the agency number as inside a credit block", () => {
    expect(phoneInAgencyFooter(HTML, "+553198887777")).toBe(true);
    expect(phoneInAgencyFooter(HTML, "+553133331111")).toBe(false);
  });
});

describe("extractContacts socials", () => {
  it("reads Instagram from JSON-LD sameAs", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type":"Organization","sameAs":["https://www.instagram.com/colegiogenesis/?utm_source=site"]}
      </script>
    </head><body></body></html>`;
    const { socials } = extractContacts(html);
    expect(socials.instagram).toBe("https://instagram.com/colegiogenesis");
  });

  it("reads Instagram from og meta content", () => {
    const html = `<html><head>
      <meta property="og:see_also" content="https://instagram.com/escola.genesis" />
    </head><body></body></html>`;
    const { socials } = extractContacts(html);
    expect(socials.instagram).toBe("https://instagram.com/escola.genesis");
  });

  it("extracts site brand from og:site_name", () => {
    const html = `<html><head>
      <meta property="og:site_name" content="Colégio Genesis" />
      <title>Home | Outro</title>
    </head><body></body></html>`;
    expect(extractSiteBrand(html)).toBe("Colégio Genesis");
  });
});

describe("normalizeSocialUrl", () => {
  it("strips utm and www", () => {
    expect(
      normalizeSocialUrl("https://www.instagram.com/foo/?utm_source=x"),
    ).toBe("https://instagram.com/foo");
  });
});

describe("extractContacts WhatsApp", () => {
  it("reads wa.me with query text", () => {
    const html = `<a href="https://wa.me/553199275701?text=Ol%C3%A1">WhatsApp</a>`;
    const phones = extractNormalizedPhones(html, "31");
    expect(phones.some((p) => p.isWhatsApp && p.e164 === "+553199275701")).toBe(
      true,
    );
  });

  it("reads api.whatsapp.com/send/?phone= form", () => {
    const html = `<a href="https://api.whatsapp.com/send/?phone=553188996208">wa</a>`;
    const phones = extractNormalizedPhones(html, "31");
    expect(phones.some((p) => p.isWhatsApp && p.e164 === "+553188996208")).toBe(
      true,
    );
  });

  it("reads WhatsApp from onclick and raw script text", () => {
    const html = `<button onclick="window.open('https://wa.me/5531912345678')">x</button>
      <script>const u="https://wa.me/5511976543210?text=oi"</script>`;
    const phones = extractNormalizedPhones(html, "31");
    const wa = phones.filter((p) => p.isWhatsApp).map((p) => p.e164);
    expect(wa).toContain("+5531912345678");
    expect(wa).toContain("+5511976543210");
  });
});

describe("SPA shell helpers", () => {
  it("detects empty #root Vite shell", () => {
    const html = `<!doctype html><html><body><div id="root"></div>
      <script type="module" src="/assets/index-abc.js"></script></body></html>`;
    expect(isSpaShell(html)).toBe(true);
    expect(listSpaScriptUrls(html, "https://example.com")).toEqual([
      "https://example.com/assets/index-abc.js",
    ]);
  });

  it("builds harvest markup from JS asset text", () => {
    const js = `href:"https://wa.me/553199275701?text=oi",ig:"https://instagram.com/diagonal_textil"`;
    const markup = harvestMarkupFromAssetText(js);
    expect(markup).toContain("wa.me/553199275701");
    expect(markup).toContain("instagram.com/diagonal_textil");
    const { socials } = extractContacts(markup);
    expect(socials.instagram).toBe("https://instagram.com/diagonal_textil");
  });
});
