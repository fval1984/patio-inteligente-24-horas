/**
 * Notas de Transporte — gerador de descrição no Financeiro.
 * Não emite NF-e e não altera cadastro de veículos nem o pátio.
 */
(function financeNotasTransporteModule(root) {
  "use strict";

  var PAYMENT_TEXT =
    "Dados para pagamento: Rostan Alexsandro de Albuquerque. CNPJ: 17.402.374/0001-36. Banco do Brasil (001). Agência: 5740-1. Conta Corrente: 44.928-8. PIX (CPF): 031.996.354-31.";

  var COPY_OK = "Texto copiado com sucesso!";
  var bound = false;

  function onlyDigits(v) {
    return String(v == null ? "" : v).replace(/\D/g, "");
  }

  function formatPlaca(v) {
    return String(v == null ? "" : v)
      .toUpperCase()
      .replace(/\s+/g, "");
  }

  function maskDate(v) {
    var d = onlyDigits(v).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0, 2) + "/" + d.slice(2);
    return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  }

  function formatDateBr(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      var p = s.split("-");
      return p[2] + "/" + p[1] + "/" + p[0];
    }
    return maskDate(s);
  }

  function maskMoney(v) {
    var digits = onlyDigits(v);
    if (!digits) return "";
    return (Number(digits) / 100)
      .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      .replace(/[\u00a0\u202f]/g, " ");
  }

  function fieldOrPlaceholder(value, placeholder) {
    var t = String(value == null ? "" : value).trim();
    return t || placeholder;
  }

  function collapseToParagraph(text) {
    return String(text || "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildTexto(fields) {
    fields = fields || {};
    var veiculo = fieldOrPlaceholder(fields.veiculo, "[VEÍCULO]");
    var placa = fieldOrPlaceholder(formatPlaca(fields.placa), "[PLACA]");
    var data = fieldOrPlaceholder(formatDateBr(fields.data), "[DATA]");
    var origem = fieldOrPlaceholder(fields.origem, "[ORIGEM]");
    var destino = fieldOrPlaceholder(fields.destino, "[DESTINO]");
    var valorMasked = maskMoney(fields.valor);
    var valor = valorMasked || "[VALOR]";
    return collapseToParagraph(
      "Serviço de transporte de veículo automotor por reboque (guincho). Veículo: " +
        veiculo +
        " Placa: " +
        placa +
        ". Data: " +
        data +
        ". Origem: " +
        origem +
        ". Destino: " +
        destino +
        ". Valor total: " +
        valor +
        ". " +
        PAYMENT_TEXT
    );
  }

  function el(id) {
    return root.document ? root.document.getElementById(id) : null;
  }

  function readFields() {
    return {
      veiculo: el("finNtVeiculo") ? el("finNtVeiculo").value : "",
      placa: el("finNtPlaca") ? el("finNtPlaca").value : "",
      data: el("finNtData") ? el("finNtData").value : "",
      origem: el("finNtOrigem") ? el("finNtOrigem").value : "",
      destino: el("finNtDestino") ? el("finNtDestino").value : "",
      valor: el("finNtValor") ? el("finNtValor").value : "",
    };
  }

  function setHint(message, isError) {
    var hint = el("finNtCopyHint");
    if (!hint) return;
    hint.textContent = message || "";
    hint.classList.toggle("is-error", !!isError);
  }

  function refreshPreview() {
    var preview = el("finNtPreview");
    if (!preview) return buildTexto(readFields());
    var text = buildTexto(readFields());
    preview.textContent = text;
    return text;
  }

  function copyFallback(text) {
    var doc = root.document;
    if (!doc) return false;
    var ta = doc.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "readonly");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    doc.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try {
      ok = doc.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    doc.body.removeChild(ta);
    return ok;
  }

  function copyTexto(text) {
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      return root.navigator.clipboard.writeText(text).then(
        function () {
          setHint(COPY_OK, false);
        },
        function () {
          if (copyFallback(text)) setHint(COPY_OK, false);
          else setHint("Não foi possível copiar automaticamente. Selecione o texto da prévia.", true);
        }
      );
    }
    if (copyFallback(text)) setHint(COPY_OK, false);
    else setHint("Não foi possível copiar automaticamente. Selecione o texto da prévia.", true);
    return Promise.resolve();
  }

  function clearFields() {
    ["finNtVeiculo", "finNtPlaca", "finNtData", "finNtOrigem", "finNtDestino", "finNtValor"].forEach(function (id) {
      var input = el(id);
      if (input) input.value = "";
    });
    setHint("", false);
    refreshPreview();
  }

  function bind() {
    if (bound) return;
    var form = el("finNtForm");
    if (!form) return;
    bound = true;

    var placa = el("finNtPlaca");
    if (placa) {
      placa.addEventListener("input", function () {
        var start = placa.selectionStart;
        var next = formatPlaca(placa.value);
        placa.value = next;
        if (typeof start === "number") placa.setSelectionRange(next.length, next.length);
        setHint("", false);
        refreshPreview();
      });
    }

    var data = el("finNtData");
    if (data) {
      data.addEventListener("input", function () {
        data.value = maskDate(data.value);
        setHint("", false);
        refreshPreview();
      });
    }

    var valor = el("finNtValor");
    if (valor) {
      valor.addEventListener("input", function () {
        valor.value = maskMoney(valor.value);
        setHint("", false);
        refreshPreview();
      });
    }

    ["finNtVeiculo", "finNtOrigem", "finNtDestino"].forEach(function (id) {
      var input = el(id);
      if (!input) return;
      input.addEventListener("input", function () {
        setHint("", false);
        refreshPreview();
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      refreshPreview();
    });

    var gerar = el("finNtGerar");
    if (gerar) {
      gerar.addEventListener("click", function () {
        refreshPreview();
        var box = el("finNtPreviewBox");
        if (box && typeof box.scrollIntoView === "function") box.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }

    var copiar = el("finNtCopiar");
    if (copiar) {
      copiar.addEventListener("click", function () {
        var text = refreshPreview();
        void copyTexto(text);
      });
    }

    var limpar = el("finNtLimpar");
    if (limpar) {
      limpar.addEventListener("click", function () {
        clearFields();
      });
    }

    refreshPreview();
  }

  var api = {
    PAYMENT_TEXT: PAYMENT_TEXT,
    COPY_OK: COPY_OK,
    formatPlaca: formatPlaca,
    formatDateBr: formatDateBr,
    maskDate: maskDate,
    maskMoney: maskMoney,
    buildTexto: buildTexto,
    bind: bind,
    refresh: refreshPreview,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.financeNotasTransporte = api;
  root.financeNotasTransporteRefresh = refreshPreview;

  if (root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", bind);
    } else {
      bind();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
