/**
 * Vínculo dos relatórios de Localizador, Pátio e Financeira.
 * Não altera o relatório de escritório. Só escolhe os veículos já gravados.
 */
(function partnerEntityReportServiceModule(global) {
  "use strict";

  const KINDS = {
    localizadores: {
      id: "localizadores",
      field: "localizador_id",
      title: "RELATÓRIO DETALHADO DE LOCALIZADOR",
      printTitle: "Relatório detalhado de localizador",
      tabLabel: "Relatório de localizador",
      entityLabel: "Localizador",
      selectPlaceholder: "Selecione o localizador",
      hint: "Selecione o localizador, defina os filtros e clique em <strong>Gerar relatório</strong>.",
      emptyHint: "Selecione um localizador para gerar o relatório detalhado.",
      loading: "Montando o relatório do localizador…",
      filePrefix: "relatorio-localizador",
      noun: "localizador",
      managerKind: "CARTEIRA",
      managerLabel: "Gestor(es) de Carteira",
      hidePatio: false,
      hideFinanceira: false,
    },
    patios: {
      id: "patios",
      field: "patio_parceiro_id",
      title: "RELATÓRIO DETALHADO DE PÁTIO",
      printTitle: "Relatório detalhado de pátio",
      tabLabel: "Relatório de pátio",
      entityLabel: "Pátio",
      selectPlaceholder: "Selecione o pátio",
      hint: "Selecione o pátio, defina os filtros e clique em <strong>Gerar relatório</strong>.",
      emptyHint: "Selecione um pátio para gerar o relatório detalhado.",
      loading: "Montando o relatório do pátio…",
      filePrefix: "relatorio-patio",
      noun: "pátio",
      managerKind: "CARTEIRA",
      managerLabel: "Gestor(es) de Carteira",
      hidePatio: true,
      hideFinanceira: false,
    },
    financeiras: {
      id: "financeiras",
      field: "financeira_id",
      title: "RELATÓRIO DETALHADO DE FINANCEIRA",
      printTitle: "Relatório detalhado de financeira",
      tabLabel: "Relatório de financeira",
      entityLabel: "Financeira",
      selectPlaceholder: "Selecione a financeira",
      hint: "Selecione a financeira, defina os filtros e clique em <strong>Gerar relatório</strong>.",
      emptyHint: "Selecione uma financeira para gerar o relatório detalhado.",
      loading: "Montando o relatório da financeira…",
      filePrefix: "relatorio-financeira",
      noun: "financeira",
      managerKind: "COBRANCA",
      managerLabel: "Gestor(es) de Cobrança",
      hidePatio: false,
      hideFinanceira: true,
    },
  };

  function kindOf(id) {
    return KINDS[String(id || "")] || null;
  }

  function linkedVehicles(vehicles, kindId, entityId) {
    const kind = kindOf(kindId);
    const id = String(entityId || "");
    if (!kind || !id) return [];
    return (vehicles || []).filter((v) => String((v && v[kind.field]) || "") === id);
  }

  function formatDocument(raw) {
    const text = String(raw == null ? "" : raw).trim();
    const digits = text.replace(/\D/g, "");
    if (digits.length === 14) {
      return {
        label: "CNPJ",
        value: digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
      };
    }
    if (digits.length === 11) {
      return {
        label: "CPF",
        value: digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"),
      };
    }
    return { label: "CNPJ/CPF", value: text };
  }

  function reportFiltersFor(kindId, filters) {
    const kind = kindOf(kindId);
    const src = filters || {};
    return {
      from: src.from || "",
      to: src.to || "",
      entradaFrom: src.entradaFrom || "",
      entradaTo: src.entradaTo || "",
      saidaFrom: src.saidaFrom || "",
      saidaTo: src.saidaTo || "",
      officeId: src.officeId || "",
      managerId: src.managerId || "",
      patioId: kind && kind.hidePatio ? "" : src.patioId || "",
      financeiraId: kind && kind.hideFinanceira ? "" : src.financeiraId || "",
      status: src.status || "",
      tipoVeiculo: src.tipoVeiculo || "",
      situacaoPatio: src.situacaoPatio || "",
      faturamento: src.faturamento || "",
      pagamento: src.pagamento || "",
    };
  }

  const api = {
    KINDS,
    kindOf,
    linkedVehicles,
    formatDocument,
    reportFiltersFor,
  };

  global.partnerEntityReportService = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
