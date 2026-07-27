/**
 * PartnersTypes — cadastro inteligente de parceiros (tabela única).
 */

export type PartnerTipoCode =
  | "INSTITUICAO_FINANCEIRA"
  | "ASSESSORIA"
  | "GUINCHEIRO"
  | "LOCALIZADOR";

export type PartnerStatus = "ATIVO" | "INATIVO";

export const PARTNER_TIPOS: {
  code: PartnerTipoCode;
  label: string;
  badge: "green" | "orange" | "purple" | "blue";
}[] = [
  { code: "INSTITUICAO_FINANCEIRA", label: "Instituição Financeira", badge: "green" },
  { code: "ASSESSORIA", label: "Assessoria Jurídica", badge: "purple" },
  { code: "GUINCHEIRO", label: "Guincheiro", badge: "orange" },
  { code: "LOCALIZADOR", label: "Localizador", badge: "blue" },
];

export interface PartnerPerfilFinanceira {
  nome_fantasia?: string;
  gestor_conta?: string;
  telefone_comercial?: string;
  email_financeiro?: string;
  departamento?: string;
  condicao_pagamento?: string;
  prazo_pagamento?: string;
  observacoes_comerciais?: string;
}

export interface PartnerPerfilGuincheiro {
  regiao_atendimento?: string;
  disponibilidade?: string;
  tipo_guincho?: string;
  valor_medio?: string | number;
  possui_plantao?: boolean | string;
  horario_atendimento?: string;
}

export interface PartnerPerfilAssessoria {
  responsavel?: string;
  oab?: string;
  especialidade?: string;
  telefone_comercial?: string;
  email_juridico?: string;
}

export interface PartnerPerfilLocalizador {
  cidade_atuacao?: string;
  regiao?: string;
  pix?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  chave_pix?: string;
}

export type PartnerPerfil =
  | PartnerPerfilFinanceira
  | PartnerPerfilGuincheiro
  | PartnerPerfilAssessoria
  | PartnerPerfilLocalizador
  | Record<string, unknown>;

export interface PartnerContato {
  id: string;
  nome: string;
  cargo?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  principal?: boolean;
}

export interface PartnerDocumento {
  id: string;
  nome: string;
  tipo: "CONTRATO" | "PROCURACAO" | "CNH" | "CNPJ" | "CPF" | "OUTROS";
  data: string;
  usuario?: string;
  path?: string;
  url?: string;
}

export interface PartnerHistoricoItem {
  id: string;
  acao: string;
  detalhe?: string;
  usuario?: string;
  data: string;
  hora: string;
}

export interface PartnerRecord {
  id?: string;
  user_id?: string;
  nome?: string | null;
  tipo?: string | null;
  cpf?: string | null;
  email?: string | null;
  contato?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  status?: string | null;
  observacoes?: string | null;
  perfil?: PartnerPerfil | null;
  contatos?: PartnerContato[] | null;
  documentos?: PartnerDocumento[] | null;
  historico?: PartnerHistoricoItem[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PartnerFilters {
  tipo: string;
  cidade: string;
  estado: string;
  status: string;
  search: string;
}

export const DEFAULT_PARTNER_FILTERS: PartnerFilters = {
  tipo: "",
  cidade: "",
  estado: "",
  status: "",
  search: "",
};

export interface PartnerSummary {
  nome: string;
  tipoLabel: string;
  veiculosAtivos: number;
  receitaAno: number;
  ultimaMovimentacao: string;
  status: string;
}

export interface FieldDef {
  key: string;
  label: string;
  kind: "text" | "email" | "tel" | "select" | "textarea" | "checkbox" | "number";
  required?: boolean;
  options?: { value: string; label: string }[];
  group: "common" | "tipo";
  span?: "half" | "full";
}
