import { describe, expect, it } from "vitest";
import { extractNormalizedPhones, phoneInAgencyFooter } from "./extract";

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
