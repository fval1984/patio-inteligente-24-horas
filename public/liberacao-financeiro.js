/**
 * Regras da integração da liberação com o Financeiro.
 * Usa somente valores já gravados. Não marca recebimento sem confirmação.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.liberacaoFinanceiro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function liberacaoFinanceiroFactory() {
  "use strict";

  const META_PREFIX = "[[finmeta:";
  const PAGOS = ["PAGO", "RECEBIDO", "BAIXADO", "QUITADO"];

  function round(n) {
    const v = Number(n || 0);
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 100) / 100;
  }

  function metaDe(r) {
    if (r && r.meta && typeof r.meta === "object") return r.meta;
    const raw = String(r?.observacoes || "");
    if (!raw.startsWith(META_PREFIX)) return {};
    const end = raw.indexOf("]]");
    if (end < 0) return {};
    try {
      return JSON.parse(raw.slice(META_PREFIX.length, end)) || {};
    } catch (_e) {
      return {};
    }
  }

  function statusDe(r) {
    return String(r?.status || "").trim().toUpperCase();
  }

  function ehAcertoParcial(r) {
    const meta = metaDe(r);
    if (meta.acerto_parcial === true) return true;
    return String(meta.origem_modulo || "").toUpperCase() === "ACERTO_PARCIAL_ESTADIA";
  }

  function responsavelUtil() {
    for (let i = 0; i < arguments.length; i += 1) {
      const text = String(arguments[i] == null ? "" : arguments[i]).replace(/\s+/g, " ").trim();
      if (!text || text.startsWith(META_PREFIX)) continue;
      if (/^sem cliente/i.test(text)) continue;
      if (text === "—" || text === "-" || text === "Cliente") continue;
      return text;
    }
    return "";
  }

  function valorALancar(valorFinal, jaRecebido) {
    return round(Math.max(0, Number(valorFinal || 0) - Number(jaRecebido || 0)));
  }

  function somarDias(ymd, dias) {
    const partes = String(ymd || "").slice(0, 10).split("-").map(Number);
    if (partes.length < 3 || !partes[0] || !partes[1] || !partes[2]) return "";
    const dt = new Date(partes[0], partes[1] - 1, partes[2]);
    dt.setDate(dt.getDate() + Number(dias || 0));
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${dt.getFullYear()}-${mm}-${dd}`;
  }

  function dataInformada(valor) {
    const ymd = String(valor || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : "";
  }

  function vencimentoFaturado(informado, baseYmd) {
    return dataInformada(informado) || somarDias(dataInformada(baseYmd), 15);
  }

  function deveEntrarNaLiberacao(r, abatimento) {
    if (!r || ehAcertoParcial(r)) return false;
    if (PAGOS.includes(statusDe(r))) return false;
    const valor = Number(r.valor);
    if (!Number.isFinite(valor) || !(valor > 0)) return false;
    if (metaDe(r).sem_cobranca === true) return false;
    return valorALancar(valor, abatimento) > 0;
  }

  function decidirRecuperacao(input) {
    const r = input?.receivable;
    const vehicle = input?.vehicle;
    const abatimento = Number(input?.abatimento || 0);
    if (!r || !vehicle) return { acao: "ignorar" };
    if (String(vehicle.status || "").toUpperCase() !== "REMOVIDO") return { acao: "ignorar" };
    if (ehAcertoParcial(r)) return { acao: "preservar" };
    const meta = metaDe(r);
    if (meta.conferencia_manual === true) return { acao: "ja_sinalizado" };
    if (meta.origem_modulo === "CONTROLE_RECEITAS") return { acao: "ignorar" };
    const status = statusDe(r);
    if (PAGOS.includes(status)) return { acao: "ja_lancado" };
    if (r.financeiro_aprovado_contas_receber === true && status === "EM_ABERTO") return { acao: "ja_lancado" };
    const fechado = !!dataInformada(r.period_end) || status === "AGUARDANDO_LANCAMENTO";
    if (!fechado) return { acao: "ignorar" };
    if (meta.sem_cobranca === true) return { acao: "ignorar" };
    const valor = Number(r.valor);
    if (!Number.isFinite(valor) || !(valor > 0)) {
      return { acao: "conferencia", motivo: "Valor da liberação ausente." };
    }
    if (valorALancar(valor, abatimento) <= 0) return { acao: "ja_lancado" };
    const responsavel = responsavelUtil(
      r.responsavel_pagamento,
      r.cobranca_destinatario_nome,
      meta.responsavel_nome,
      vehicle.responsavel_financeiro_nome
    );
    if (!responsavel) {
      return { acao: "conferencia", motivo: "Responsável pelo pagamento não consta na liberação." };
    }
    const base = dataInformada(r.period_end) || dataInformada(vehicle.data_saida);
    if (!base) {
      return { acao: "conferencia", motivo: "Data da liberação ausente." };
    }
    return {
      acao: "entradas",
      valor: valorALancar(valor, abatimento),
      valorFinal: round(valor),
      responsavel,
      vencimento: vencimentoFaturado(r.data_vencimento, base),
    };
  }

  const MESES = [
    "JANEIRO",
    "FEVEREIRO",
    "MARÇO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO",
  ];

  function dataOrigemDebito(item) {
    const ymd = String(item?.origem || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : "";
  }

  function rotuloMesOrigem(ymd) {
    const data = dataOrigemDebito({ origem: ymd });
    if (!data) return "SEM DATA DE ORIGEM";
    const mes = Number(data.slice(5, 7));
    const nome = MESES[mes - 1];
    if (!nome) return "SEM DATA DE ORIGEM";
    return `${nome} DE ${data.slice(0, 4)}`;
  }

  function agruparPorMesOrigem(itens) {
    const lista = (Array.isArray(itens) ? itens : []).map((item, index) => ({
      item,
      index,
      origem: dataOrigemDebito(item),
    }));
    lista.sort((a, b) => {
      if (!a.origem && !b.origem) return a.index - b.index;
      if (!a.origem) return 1;
      if (!b.origem) return -1;
      if (a.origem !== b.origem) return a.origem < b.origem ? -1 : 1;
      return a.index - b.index;
    });
    const grupos = [];
    let atual = null;
    for (const row of lista) {
      const chave = row.origem ? row.origem.slice(0, 7) : "";
      if (!atual || atual.chave !== chave) {
        atual = {
          chave,
          rotulo: rotuloMesOrigem(row.origem),
          itens: [],
          aberto: 0,
        };
        grupos.push(atual);
      }
      atual.itens.push(row.item);
      atual.aberto = round(atual.aberto + Number(row.item?.saldo || 0));
    }
    return {
      grupos,
      aberto: round(grupos.reduce((soma, grupo) => soma + grupo.aberto, 0)),
      total: lista.length,
    };
  }

  function faixasVisiveis(itens, limite) {
    const agrupado = agruparPorMesOrigem(itens);
    const teto = Number(limite);
    const maximo = Number.isFinite(teto) && teto >= 0 ? teto : agrupado.total;
    const grupos = [];
    let mostrado = 0;
    for (const grupo of agrupado.grupos) {
      if (mostrado >= maximo) break;
      const visiveis = grupo.itens.slice(0, maximo - mostrado);
      mostrado += visiveis.length;
      grupos.push({
        chave: grupo.chave,
        rotulo: grupo.rotulo,
        aberto: grupo.aberto,
        itens: visiveis,
        completo: visiveis.length === grupo.itens.length,
      });
    }
    return {
      grupos,
      aberto: agrupado.aberto,
      total: agrupado.total,
      mostrado,
      completo: mostrado >= agrupado.total,
    };
  }

  return {
    round,
    metaDe,
    ehAcertoParcial,
    responsavelUtil,
    valorALancar,
    somarDias,
    vencimentoFaturado,
    deveEntrarNaLiberacao,
    decidirRecuperacao,
    dataOrigemDebito,
    rotuloMesOrigem,
    agruparPorMesOrigem,
    faixasVisiveis,
  };
});
