import { PORTE_LABELS } from "@/lib/copy";

export function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "").padStart(14, "0");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatPhone(ddd: string | null, tel: string | null): string | null {
  if (!ddd || !tel) return null;
  const t = tel.replace(/\D/g, "");
  if (t.length === 9) {
    return `(${ddd}) ${t.slice(0, 5)}-${t.slice(5)}`;
  }
  if (t.length === 8) {
    return `(${ddd}) ${t.slice(0, 4)}-${t.slice(4)}`;
  }
  if (t.length >= 9) {
    return `(${ddd}) ${t.slice(0, 5)}-${t.slice(5)}`;
  }
  if (t.length >= 8) {
    return `(${ddd}) ${t.slice(0, 4)}-${t.slice(4)}`;
  }
  return `(${ddd}) ${t}`;
}

export function toE164(ddd: string | null, tel: string | null): string | null {
  if (!ddd || !tel) return null;
  return `55${ddd}${tel.replace(/\D/g, "")}`;
}

export function formatCapital(value: number | null): string {
  if (value === null || value === undefined) return "NÃO ENCONTRADO";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatCnae(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  const d = codigo.replace(/\D/g, "").padStart(7, "0").slice(0, 7);
  return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}`;
}

export function formatPorte(porte: string | null): string {
  if (!porte) return "NÃO ENCONTRADO";
  return PORTE_LABELS[porte] ?? porte;
}

export function formatDateBr(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR");
}

export function formatRelativeShort(iso: string, now = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(
    then.getFullYear(),
    then.getMonth(),
    then.getDate(),
  );
  const days = Math.round(
    (startToday.getTime() - startThen.getTime()) / 86_400_000,
  );
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days > 1 && days < 30) return `há ${days} dias`;
  return formatDateBr(iso) ?? then.toLocaleDateString("pt-BR");
}

export function yearsSince(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1;
  return years;
}

export function emptyOr<T>(value: T | null | undefined, fallback = "NÃO ENCONTRADO"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}
