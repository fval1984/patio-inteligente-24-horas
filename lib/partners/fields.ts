/**
 * Configuração de campos por Tipo de Parceiro — fonte única para form condicional.
 */
import type { FieldDef, PartnerTipoCode } from "./types";
import { PARTNER_TIPOS } from "./types";

export const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
].map((uf) => ({ value: uf, label: uf }));

export const COMMON_FIELDS: FieldDef[] = [
  { key: "nome", label: "Nome", kind: "text", required: true, group: "common", span: "half" },
  {
    key: "tipo",
    label: "Tipo de Parceiro",
    kind: "select",
    required: true,
    group: "common",
    span: "half",
    options: PARTNER_TIPOS.map((t) => ({ value: t.code, label: t.label })),
  },
  { key: "cpf", label: "CPF/CNPJ", kind: "text", group: "common", span: "half" },
  { key: "telefone", label: "Telefone", kind: "tel", group: "common", span: "half" },
  { key: "whatsapp", label: "WhatsApp", kind: "tel", group: "common", span: "half" },
  { key: "email", label: "E-mail", kind: "email", group: "common", span: "half" },
  { key: "cep", label: "CEP", kind: "text", group: "common", span: "half" },
  { key: "endereco", label: "Endereço", kind: "text", group: "common", span: "half" },
  { key: "numero", label: "Número", kind: "text", group: "common", span: "half" },
  { key: "complemento", label: "Complemento", kind: "text", group: "common", span: "half" },
  { key: "bairro", label: "Bairro", kind: "text", group: "common", span: "half" },
  { key: "cidade", label: "Cidade", kind: "text", group: "common", span: "half" },
  {
    key: "estado",
    label: "Estado",
    kind: "select",
    group: "common",
    span: "half",
    options: [{ value: "", label: "—" }, ...UF_OPTIONS],
  },
  {
    key: "status",
    label: "Status",
    kind: "select",
    required: true,
    group: "common",
    span: "half",
    options: [
      { value: "ATIVO", label: "Ativo" },
      { value: "INATIVO", label: "Inativo" },
    ],
  },
  { key: "observacoes", label: "Observações", kind: "textarea", group: "common", span: "full" },
];

export const TIPO_FIELDS: Record<PartnerTipoCode, FieldDef[]> = {
  INSTITUICAO_FINANCEIRA: [
    { key: "nome_fantasia", label: "Nome Fantasia", kind: "text", group: "tipo", span: "half" },
    { key: "gestor_conta", label: "Gestor da Conta", kind: "text", required: true, group: "tipo", span: "half" },
    { key: "telefone_comercial", label: "Telefone Comercial", kind: "tel", group: "tipo", span: "half" },
    { key: "email_financeiro", label: "E-mail Financeiro", kind: "email", group: "tipo", span: "half" },
    { key: "departamento", label: "Departamento", kind: "text", group: "tipo", span: "half" },
    { key: "condicao_pagamento", label: "Condição de Pagamento", kind: "text", group: "tipo", span: "half" },
    { key: "prazo_pagamento", label: "Prazo de Pagamento", kind: "text", group: "tipo", span: "half" },
    { key: "observacoes_comerciais", label: "Observações Comerciais", kind: "textarea", group: "tipo", span: "full" },
  ],
  GUINCHEIRO: [
    { key: "regiao_atendimento", label: "Região de Atendimento", kind: "text", required: true, group: "tipo", span: "half" },
    { key: "disponibilidade", label: "Disponibilidade", kind: "text", group: "tipo", span: "half" },
    { key: "tipo_guincho", label: "Tipo de Guincho", kind: "text", group: "tipo", span: "half" },
    { key: "valor_medio", label: "Valor Médio", kind: "number", group: "tipo", span: "half" },
    {
      key: "possui_plantao",
      label: "Possui Plantão",
      kind: "select",
      group: "tipo",
      span: "half",
      options: [
        { value: "", label: "—" },
        { value: "sim", label: "Sim" },
        { value: "nao", label: "Não" },
      ],
    },
    { key: "horario_atendimento", label: "Horário de Atendimento", kind: "text", group: "tipo", span: "half" },
  ],
  ASSESSORIA: [
    { key: "responsavel", label: "Responsável", kind: "text", group: "tipo", span: "half" },
    { key: "oab", label: "Número da OAB", kind: "text", required: true, group: "tipo", span: "half" },
    { key: "especialidade", label: "Especialidade", kind: "text", group: "tipo", span: "half" },
    { key: "telefone_comercial", label: "Telefone Comercial", kind: "tel", group: "tipo", span: "half" },
    { key: "email_juridico", label: "E-mail Jurídico", kind: "email", group: "tipo", span: "half" },
  ],
  LOCALIZADOR: [
    { key: "cidade_atuacao", label: "Cidade de Atuação", kind: "text", group: "tipo", span: "half" },
    { key: "regiao", label: "Região", kind: "text", group: "tipo", span: "half" },
    { key: "pix", label: "PIX", kind: "text", group: "tipo", span: "half" },
    { key: "banco", label: "Banco", kind: "text", group: "tipo", span: "half" },
    { key: "agencia", label: "Agência", kind: "text", group: "tipo", span: "half" },
    { key: "conta", label: "Conta", kind: "text", group: "tipo", span: "half" },
    { key: "chave_pix", label: "Chave PIX", kind: "text", group: "tipo", span: "half" },
  ],
};

export function fieldsForTipo(tipo: string | null | undefined): FieldDef[] {
  const code = normalizePartnerTipo(tipo);
  return [...COMMON_FIELDS, ...(TIPO_FIELDS[code] || [])];
}

export function normalizePartnerTipo(tipo: string | null | undefined): PartnerTipoCode {
  const t = String(tipo || "")
    .trim()
    .toUpperCase();
  if (t === "INSTITUICAO_FINANCEIRA" || t === "FINANCEIRA") return "INSTITUICAO_FINANCEIRA";
  if (t === "ASSESSORIA" || t === "ASSESSORIA_JURIDICA") return "ASSESSORIA";
  if (t === "GUINCHEIRO" || t === "REMOCAO") return "GUINCHEIRO";
  if (t === "LOCALIZADOR" || t === "PARCEIRO" || !t) return "LOCALIZADOR";
  return "LOCALIZADOR";
}

export function partnerTipoLabel(tipo: string | null | undefined): string {
  const code = normalizePartnerTipo(tipo);
  return PARTNER_TIPOS.find((x) => x.code === code)?.label || code;
}

export function partnerTipoBadge(tipo: string | null | undefined): "green" | "orange" | "purple" | "blue" {
  const code = normalizePartnerTipo(tipo);
  return PARTNER_TIPOS.find((x) => x.code === code)?.badge || "blue";
}
