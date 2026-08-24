import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { isRuntimeProduction } from "@/lib/env/deploy";

const DEV_SALT = "grid-podium-integrations";

function kmsKey(): Buffer {
  const raw = process.env.INTEGRATION_KMS_KEY?.trim();
  if (!raw) {
    if (isRuntimeProduction()) {
      throw new Error(
        "INTEGRATION_KMS_KEY é obrigatória em produção para credenciais de Conexões.",
      );
    }
    return scryptSync("grid-dev-integrations", DEV_SALT, 32);
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return scryptSync(raw, DEV_SALT, 32);
}

export function encryptJson(value: Record<string, string>): {
  ciphertext: string;
  nonce: string;
} {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kmsKey(), nonce);
  const plain = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
    nonce: nonce.toString("base64"),
  };
}

export function decryptJson(
  ciphertextB64: string,
  nonceB64: string,
): Record<string, string> {
  const packed = Buffer.from(ciphertextB64, "base64");
  const nonce = Buffer.from(nonceB64, "base64");
  const tag = packed.subarray(packed.length - 16);
  const encrypted = packed.subarray(0, packed.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", kmsKey(), nonce);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const parsed = JSON.parse(plain.toString("utf8")) as Record<string, string>;
  return parsed;
}

export function newHmacSecret(): string {
  return randomBytes(32).toString("hex");
}
