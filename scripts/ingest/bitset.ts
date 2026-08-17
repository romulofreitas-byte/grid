/**
 * Membership for 8-digit CNPJ básico without V8 Set's ~16.7M element cap.
 * 100 million possible values → 12.5 MB bitset.
 */

const CNPJ_BASICO_RANGE = 100_000_000;
const BITSET_BYTES = CNPJ_BASICO_RANGE / 8;

export function cnpjBasicoIndex(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return -1;
  const n = Number(digits);
  if (!Number.isInteger(n) || n < 0 || n >= CNPJ_BASICO_RANGE) return -1;
  return n;
}

export class CnpjBitset {
  private readonly bits = Buffer.alloc(BITSET_BYTES);
  size = 0;

  add(raw: string): boolean {
    const n = cnpjBasicoIndex(raw);
    if (n < 0) return false;
    const byte = n >>> 3;
    const mask = 1 << (n & 7);
    if (this.bits[byte] & mask) return false;
    this.bits[byte] |= mask;
    this.size += 1;
    return true;
  }

  has(raw: string): boolean {
    const n = cnpjBasicoIndex(raw);
    if (n < 0) return false;
    const byte = n >>> 3;
    const mask = 1 << (n & 7);
    return (this.bits[byte] & mask) !== 0;
  }
}
