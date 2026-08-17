import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "./crypto";

describe("encryptJson / decryptJson", () => {
  it("round-trips a secret blob", () => {
    const sealed = encryptJson({ hmac_secret: "abc", webhook_url: "https://x.test" });
    expect(sealed.ciphertext).not.toContain("abc");
    const plain = decryptJson(sealed.ciphertext, sealed.nonce);
    expect(plain).toEqual({ hmac_secret: "abc", webhook_url: "https://x.test" });
  });
});
