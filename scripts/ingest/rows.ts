/**
 * Map RF CSV rows onto GRID table tuples.
 */

import {
  CNAE,
  EMPRESAS,
  ESTABELECIMENTOS,
  MUNICIPIOS,
  NATUREZAS,
  QUALIFICACOES,
  SIMPLES,
  SOCIOS,
} from "./layout";
import {
  buildCnpj,
  formatDate,
  normalizeCep,
  normalizeDdd,
  normalizeEmail,
  normalizePhone,
  normalizeUf,
  parseCapitalSocial,
  parseCnaeSecundarios,
  parseDate,
  parseSnFlag,
  pickField,
} from "./parse";
import { pgTextArray } from "./copy";

function digits(raw: string, len: number): string | null {
  const value = raw.replace(/\D/g, "");
  if (!value) return null;
  return value.padStart(len, "0").slice(0, len);
}

function parseIntOrNull(raw: string): number | null {
  const value = raw.replace(/\D/g, "");
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const COMPANY_COLUMNS = [
  "cnpj_basico",
  "razao_social",
  "natureza_id",
  "qualificacao_responsavel",
  "capital_social",
  "porte",
] as const;

export function mapCompany(
  fields: string[],
): Array<string | number | boolean | null> | null {
  const cnpj_basico = digits(pickField(fields, EMPRESAS.cnpj_basico), 8);
  const razao_social = pickField(fields, EMPRESAS.razao_social);
  if (!cnpj_basico || !razao_social) return null;
  const porteRaw = pickField(fields, EMPRESAS.porte).replace(/\D/g, "");
  const porte = porteRaw ? porteRaw.padStart(2, "0").slice(0, 2) : null;
  return [
    cnpj_basico,
    razao_social,
    parseIntOrNull(pickField(fields, EMPRESAS.natureza_id)),
    parseIntOrNull(pickField(fields, EMPRESAS.qualificacao_responsavel)),
    parseCapitalSocial(pickField(fields, EMPRESAS.capital_social)),
    porte,
  ];
}

export const ESTABLISHMENT_COLUMNS = [
  "cnpj",
  "cnpj_basico",
  "is_matriz",
  "nome_fantasia",
  "situacao",
  "data_situacao",
  "data_inicio",
  "cnae_principal",
  "cnae_secundarios",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cep",
  "uf",
  "municipio_id",
  "ddd1",
  "telefone1",
  "ddd2",
  "telefone2",
  "email",
] as const;

export function mapEstablishment(
  fields: string[],
): Array<string | number | boolean | null> | null {
  const cnpj_basico = digits(pickField(fields, ESTABELECIMENTOS.cnpj_basico), 8);
  const ordem = digits(pickField(fields, ESTABELECIMENTOS.cnpj_ordem), 4);
  const dv = digits(pickField(fields, ESTABELECIMENTOS.cnpj_dv), 2);
  if (!cnpj_basico || !ordem || !dv) return null;
  const cnpj = buildCnpj(cnpj_basico, ordem, dv);
  if (cnpj.length !== 14) return null;

  const cnae = digits(pickField(fields, ESTABELECIMENTOS.cnae_principal), 7);
  const municipio_id = parseIntOrNull(pickField(fields, ESTABELECIMENTOS.municipio_id));
  const uf = normalizeUf(pickField(fields, ESTABELECIMENTOS.uf));
  const situacao = pickField(fields, ESTABELECIMENTOS.situacao).padStart(2, "0").slice(0, 2);
  if (!cnae || municipio_id === null || !uf || !situacao) return null;

  const tipo = pickField(fields, ESTABELECIMENTOS.tipo_logradouro);
  const log = pickField(fields, ESTABELECIMENTOS.logradouro);
  const logradouro = [tipo, log].filter(Boolean).join(" ").trim() || null;

  const ident = pickField(fields, ESTABELECIMENTOS.identificador_matriz_filial);

  return [
    cnpj,
    cnpj_basico,
    ident === "1",
    pickField(fields, ESTABELECIMENTOS.nome_fantasia) || null,
    situacao,
    formatDate(parseDate(pickField(fields, ESTABELECIMENTOS.data_situacao))),
    formatDate(parseDate(pickField(fields, ESTABELECIMENTOS.data_inicio))),
    cnae,
    pgTextArray(parseCnaeSecundarios(pickField(fields, ESTABELECIMENTOS.cnae_secundarios))),
    logradouro,
    pickField(fields, ESTABELECIMENTOS.numero) || null,
    pickField(fields, ESTABELECIMENTOS.complemento) || null,
    pickField(fields, ESTABELECIMENTOS.bairro) || null,
    normalizeCep(pickField(fields, ESTABELECIMENTOS.cep)),
    uf,
    municipio_id,
    normalizeDdd(pickField(fields, ESTABELECIMENTOS.ddd1)),
    normalizePhone(pickField(fields, ESTABELECIMENTOS.telefone1)),
    normalizeDdd(pickField(fields, ESTABELECIMENTOS.ddd2)),
    normalizePhone(pickField(fields, ESTABELECIMENTOS.telefone2)),
    normalizeEmail(pickField(fields, ESTABELECIMENTOS.email)),
  ];
}

export function establishmentCnpjBasico(fields: string[]): string | null {
  return digits(pickField(fields, ESTABELECIMENTOS.cnpj_basico), 8);
}

export const PARTNER_COLUMNS = [
  "cnpj_basico",
  "nome",
  "qualificacao_id",
  "data_entrada",
  "faixa_etaria",
] as const;

export function mapPartner(
  fields: string[],
): Array<string | number | boolean | null> | null {
  const cnpj_basico = digits(pickField(fields, SOCIOS.cnpj_basico), 8);
  const nome = pickField(fields, SOCIOS.nome);
  const qualificacao_id = parseIntOrNull(pickField(fields, SOCIOS.qualificacao_id));
  if (!cnpj_basico || !nome || qualificacao_id === null) return null;
  const faixa = parseIntOrNull(pickField(fields, SOCIOS.faixa_etaria));
  return [
    cnpj_basico,
    nome,
    qualificacao_id,
    formatDate(parseDate(pickField(fields, SOCIOS.data_entrada))),
    faixa,
  ];
}

export const SIMPLES_COLUMNS = [
  "cnpj_basico",
  "opcao_simples",
  "opcao_mei",
] as const;

export function mapSimples(
  fields: string[],
): Array<string | number | boolean | null> | null {
  const cnpj_basico = digits(pickField(fields, SIMPLES.cnpj_basico), 8);
  if (!cnpj_basico) return null;
  return [
    cnpj_basico,
    parseSnFlag(pickField(fields, SIMPLES.opcao_simples)),
    parseSnFlag(pickField(fields, SIMPLES.opcao_mei)),
  ];
}

export const CNAE_COLUMNS = ["codigo", "descricao"] as const;

export function mapCnae(
  fields: string[],
): Array<string | number | boolean | null> | null {
  const codigo = digits(pickField(fields, CNAE.codigo), 7);
  const descricao = pickField(fields, CNAE.descricao);
  if (!codigo || !descricao) return null;
  return [codigo, descricao];
}

export const MUNICIPIO_COLUMNS = ["id", "nome"] as const;

export function mapMunicipio(
  fields: string[],
): Array<string | number | boolean | null> | null {
  const id = parseIntOrNull(pickField(fields, MUNICIPIOS.id));
  const nome = pickField(fields, MUNICIPIOS.nome);
  if (id === null || !nome) return null;
  return [id, nome];
}

export const NATUREZA_COLUMNS = ["id", "descricao"] as const;

export function mapNatureza(
  fields: string[],
): Array<string | number | boolean | null> | null {
  const id = parseIntOrNull(pickField(fields, NATUREZAS.id));
  const descricao = pickField(fields, NATUREZAS.descricao);
  if (id === null || !descricao) return null;
  return [id, descricao];
}

export const QUALIFICACAO_COLUMNS = ["id", "descricao"] as const;

export function mapQualificacao(
  fields: string[],
): Array<string | number | boolean | null> | null {
  const id = parseIntOrNull(pickField(fields, QUALIFICACOES.id));
  const descricao = pickField(fields, QUALIFICACOES.descricao);
  if (id === null || !descricao) return null;
  return [id, descricao];
}
