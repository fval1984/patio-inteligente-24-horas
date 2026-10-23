/**
 * Recibo AMPLIGUARD — reprodução do modelo oficial.
 * A arte de fundo é a imagem aprovada. Só os dados variáveis são sobrepostos.
 */
(function () {
  var MODELO = "/assets/recibo/modelo.jpg";
  var NAVY = "#07182A";

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function moeda(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) n = 0;
    var negativo = n < 0;
    n = Math.abs(n);
    var partes = n.toFixed(2).split(".");
    var inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (negativo ? "- " : "") + "R$ " + inteiro + "," + partes[1];
  }

  var UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  var DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  var DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  var CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function extensoAte999(n) {
    if (n === 0) return "";
    if (n === 100) return "cem";
    var c = Math.floor(n / 100);
    var d = Math.floor((n % 100) / 10);
    var u = n % 10;
    var partes = [];
    if (c) partes.push(CENTENAS[c]);
    if (d === 1) partes.push(DEZ_A_DEZENOVE[u]);
    else {
      if (d) partes.push(DEZENAS[d]);
      if (u) partes.push(UNIDADES[u]);
    }
    return partes.join(" e ");
  }

  function extensoInteiro(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return "zero";
    if (n > 999999999) return String(n);
    var milhoes = Math.floor(n / 1000000);
    var milhares = Math.floor((n % 1000000) / 1000);
    var resto = n % 1000;
    var partes = [];
    if (milhoes) {
      partes.push({
        valor: milhoes,
        texto: milhoes === 1 ? "um milhão" : extensoAte999(milhoes) + " milhões",
      });
    }
    if (milhares) {
      partes.push({
        valor: milhares,
        texto: milhares === 1 ? "mil" : extensoAte999(milhares) + " mil",
      });
    }
    if (resto) partes.push({ valor: resto, texto: extensoAte999(resto) });
    if (!partes.length) return "zero";
    var texto = partes[0].texto;
    for (var i = 1; i < partes.length; i++) {
      var grupo = partes[i].valor;
      var liga = grupo < 100 || grupo % 100 === 0 ? " e " : " ";
      texto += liga + partes[i].texto;
    }
    return texto;
  }

  function parseValorRecibo(value) {
    if (typeof value === "number") return value;
    var s = String(value == null ? "" : value).trim();
    if (!s) return 0;
    s = s.replace(/[^\d,.-]/g, "");
    if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.indexOf(",") >= 0) s = s.replace(",", ".");
    var n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function valorPorExtenso(value) {
    var n = parseValorRecibo(value);
    if (!Number.isFinite(n) || n < 0) n = 0;
    var cents = Math.round(n * 100);
    var inteiro = Math.floor(cents / 100);
    var centavos = cents % 100;
    var partes = [];
    if (inteiro > 0) {
      var reais = extensoInteiro(inteiro) + (inteiro === 1 ? " real" : " reais");
      if (inteiro >= 1000000 && inteiro % 1000000 === 0) {
        reais = extensoInteiro(inteiro) + " de " + (inteiro === 1 ? "real" : "reais");
      }
      partes.push(reais);
    }
    if (centavos > 0) {
      partes.push(extensoInteiro(centavos) + (centavos === 1 ? " centavo" : " centavos"));
    }
    if (!partes.length) partes.push("zero reais");
    return partes.join(" e ") + ".";
  }

  function campo(opts, text) {
    var style = [
      "left:" + opts.x + "px",
      "top:" + opts.y + "px",
      "width:" + opts.w + "px",
      "height:" + opts.h + "px",
      "font-size:" + opts.size + "px",
      "font-weight:" + (opts.weight || 600),
      "color:" + (opts.color || "#1a1c20"),
      "background:" + (opts.bg || "#ffffff"),
      "letter-spacing:" + (opts.tracking || "0"),
      "justify-content:" + (opts.align === "center" ? "center" : "flex-start"),
      "text-align:" + (opts.align === "center" ? "center" : "left"),
      "text-transform:" + (opts.upper ? "uppercase" : "none"),
    ].join(";");
    var cls = "rv" + (opts.wrap ? " rv-wrap" : "");
    return '<div class="' + cls + '" style="' + style + '">' + esc(text || "") + "</div>";
  }

  function sheetHtml(data, imagem) {
    var cepLinha = data.cep ? "CEP: " + data.cep : "";
    var html = "";
    html += campo({ x: 668, y: 154, w: 98, h: 18, size: 15, weight: 700, align: "center", bg: "#F3F4F6" }, data.numero);
    html += campo({ x: 846, y: 154, w: 112, h: 18, size: 15, weight: 700, align: "center", bg: "#F3F4F6" }, data.emissao);
    html += campo({ x: 92, y: 249, w: 220, h: 18, size: 13, weight: 600 }, data.nome);
    html += campo({ x: 418, y: 249, w: 130, h: 16, size: 13, weight: 600 }, data.documento);
    html += campo({ x: 638, y: 247, w: 330, h: 15, size: 12, weight: 600 }, data.endereco);
    html += campo({ x: 638, y: 263, w: 140, h: 14, size: 12, weight: 600 }, cepLinha);
    html += campo({ x: 92, y: 342, w: 90, h: 16, size: 14, weight: 800, upper: true }, data.placa);
    html += campo({ x: 294, y: 341, w: 250, h: 18, size: 13, weight: 700, upper: true }, data.veiculo);
    html += campo({ x: 654, y: 341, w: 210, h: 18, size: 13, weight: 700, upper: true }, data.instituicao);
    html += campo({ x: 96, y: 462, w: 190, h: 17, size: 13, weight: 600, align: "center" }, data.periodo);
    html += campo({ x: 360, y: 462, w: 100, h: 17, size: 13, weight: 600, align: "center" }, data.quantidade);
    html += campo({ x: 575, y: 462, w: 110, h: 17, size: 13, weight: 600, align: "center" }, data.valorUnitario);
    html += campo({ x: 812, y: 462, w: 110, h: 17, size: 13, weight: 700, align: "center" }, data.valorTotal);
    html += campo(
      { x: 746, y: 548, w: 196, h: 34, size: 28, weight: 800, align: "center", color: "#ffffff", bg: NAVY, tracking: "-0.03em" },
      data.valorTotal
    );
    html += campo(
      { x: 664, y: 584, w: 312, h: 36, size: 11, weight: 700, align: "center", color: "#f4f7fb", bg: NAVY, wrap: true },
      data.totalExtenso
    );
    return (
      '<div class="ag-recibo">' +
      '<div class="ag-recibo-folha">' +
      '<img class="ag-recibo-bg" src="' +
      esc(imagem || MODELO) +
      '" alt="" />' +
      html +
      "</div>" +
      '<div class="ag-recibo-assinatura">' +
      '<div class="ag-recibo-assinatura-linha"></div>' +
      "<p>RESPONSÁVEL PELO PÁTIO — AMPLIGUARD</p>" +
      "</div>" +
      "</div>"
    );
  }

  function css() {
    return (
      "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&display=swap');" +
      ".ag-recibo{position:relative;width:1024px;height:auto;background:#fff;font-family:Montserrat,Arial,Helvetica,sans-serif;}" +
      ".ag-recibo-folha{position:relative;width:1024px;height:682px;overflow:hidden;background:#fff;}" +
      ".ag-recibo-bg{position:absolute;left:0;top:0;width:1024px;height:682px;display:block;}" +
      ".ag-recibo .rv{position:absolute;z-index:1;box-sizing:border-box;display:flex;align-items:center;margin:0;padding:0 2px;line-height:1;white-space:nowrap;overflow:hidden;font-family:Montserrat,Arial,Helvetica,sans-serif;}" +
      ".ag-recibo .rv.rv-wrap{white-space:normal;line-height:1.2;overflow:hidden;padding:0 8px;}" +
      ".ag-recibo-assinatura{width:1024px;box-sizing:border-box;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:42px 48px 16px;}" +
      ".ag-recibo-assinatura-linha{width:360px;height:0;border-top:2px solid #07182A;margin:0 0 8px;}" +
      ".ag-recibo-assinatura p{margin:0;font-size:12px;font-weight:700;letter-spacing:0.06em;color:#07182A;text-align:center;}"
    );
  }

  function printHtml(data, imagem) {
    return (
      "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\" />" +
      "<title>RECIBO</title><style>" +
      "@page{size:A4 landscape;margin:0;}" +
      "html,body{margin:0;padding:0;background:#fff;}" +
      css() +
      "@media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
      ".ag-recibo{zoom:1.02;margin:2mm auto 0;}}</style></head><body>" +
      sheetHtml(data, imagem) +
      "</body></html>"
    );
  }

  var DESCRICAO_SERVICO =
    "Serviços de guarda e custódia do veículo automotor, referentes às estadias no pátio da AMPLIGUARD.";

  function reciboTexto(value) {
    var text = String(value == null ? "" : value).trim();
    if (!text || text === "-" || text === "—") return "—";
    return text;
  }

  function reciboCdrExtraCss() {
    return (
      ".ticket .obs{white-space:pre-wrap;min-height:18mm;margin:0.8mm 0 0;}" +
      ".ticket .sign-block{margin-top:1mm;page-break-inside:avoid;break-inside:avoid;}" +
      ".ticket .sign-space{height:18mm;}" +
      ".ticket .sign-line{border:0;border-top:1px solid #000;width:62mm;height:0;margin:0 auto 1.4mm;}" +
      ".ticket .sign-label,.ticket .sign-meta{margin:0;text-align:center;}" +
      ".ticket .sign-label{font-size:11px;font-weight:800;letter-spacing:0.02em;}" +
      ".ticket .sign-meta{margin-top:0.5mm;font-size:11px;}"
    );
  }

  function buildReciboCdrBlocks(data) {
    data = data || {};
    var blocks = [
      { kind: "title", text: "RECIBO" },
      { kind: "title", text: "PRESTAÇÃO DE SERVIÇOS" },
      { kind: "sec", text: "DADOS DO RECIBO" },
      { kind: "line", text: "Nº do recibo: " + reciboTexto(data.numero) },
      { kind: "line", text: "Data de emissão: " + reciboTexto(data.emissao) },
      { kind: "sep", text: "" },
      { kind: "sec", text: "DADOS DO TOMADOR" },
      { kind: "line", text: "Nome / Razão social: " + reciboTexto(data.nome) },
      { kind: "line", text: "CPF / CNPJ: " + reciboTexto(data.documento) },
    ];
    if (String(data.endereco || "").trim()) blocks.push({ kind: "line", text: "Endereço: " + String(data.endereco).trim() });
    if (String(data.cep || "").trim()) blocks.push({ kind: "line", text: "CEP: " + String(data.cep).trim() });
    blocks.push(
      { kind: "sep", text: "" },
      { kind: "sec", text: "DADOS DO VEÍCULO" },
      { kind: "hot", text: "RPP: " + reciboTexto(data.rpp) },
      { kind: "placa", text: "Placa: " + reciboTexto(data.placa) },
      { kind: "line", text: "Veículo: " + reciboTexto(data.veiculo) },
      { kind: "line", text: "Cor: " + reciboTexto(data.cor) }
    );
    if (String(data.instituicao || "").trim()) {
      blocks.push({ kind: "line", text: "Instituição financeira: " + String(data.instituicao).trim() });
    }
    blocks.push(
      { kind: "line", text: "Data de Entrada: " + reciboTexto(data.entrada) },
      { kind: "line", text: "Data de Saída: " + reciboTexto(data.saida) },
      { kind: "line", text: "Período: " + reciboTexto(data.periodo) },
      { kind: "line", text: "Quantidade: " + reciboTexto(data.quantidade) },
      { kind: "sep", text: "" },
      { kind: "sec", text: "DESCRIÇÃO DOS SERVIÇOS" },
      { kind: "line", text: data.descricao || DESCRICAO_SERVICO },
      { kind: "line", text: "Valor unitário: " + reciboTexto(data.valorUnitario) },
      { kind: "total", text: "VALOR TOTAL: " + reciboTexto(data.valorTotal) },
      { kind: "line", text: "Valor por extenso: " + reciboTexto(data.totalExtenso) },
      { kind: "sep", text: "" },
      { kind: "sec", text: "DADOS PARA PAGAMENTO" }
    );
    (data.pagamento || []).forEach(function (linha) {
      blocks.push({ kind: "line", text: String(linha) });
    });
    blocks.push({ kind: "sep", text: "" }, { kind: "sec", text: "INFORMAÇÕES ADICIONAIS / OBSERVAÇÕES" });
    var obs = String(data.observacoes || "").replace(/\s+$/g, "").replace(/^\s+/g, "");
    if (!obs) blocks.push({ kind: "gap", mm: 16 });
    else {
      obs.split(/\n/).forEach(function (linha) {
        if (!String(linha).trim()) blocks.push({ kind: "gap", mm: 3.2 });
        else blocks.push({ kind: "line", text: linha });
      });
    }
    blocks.push(
      { kind: "sep", text: "" },
      { kind: "gap", mm: 16 },
      { kind: "rule", text: "" },
      { kind: "sec", text: "RESPONSÁVEL PELO PÁTIO — AMPLIGUARD" }
    );
    if (String(data.responsavelPatioNome || "").trim()) {
      blocks.push({ kind: "line", text: "Nome: " + String(data.responsavelPatioNome).trim() });
    }
    if (String(data.responsavelPatioCpf || "").trim()) {
      blocks.push({ kind: "line", text: "CPF: " + String(data.responsavelPatioCpf).trim() });
    }
    blocks.push(
      { kind: "sep", text: "" },
      { kind: "foot", text: "AMPLIGUARD" },
      { kind: "foot-tag", text: "Guarda, Custódia e Remoção de Veículos" }
    );
    return blocks;
  }

  function buildReciboCdrBody(data, imagem) {
    data = data || {};
    var logo = imagem || "/assets/ampliguard-marca.png?v=20260917logo2";
    var obs = String(data.observacoes || "").replace(/\s+$/g, "").replace(/^\s+/g, "");
    var nomePatio = String(data.responsavelPatioNome || "").trim();
    var cpfPatio = String(data.responsavelPatioCpf || "").trim();
    var endereco = String(data.endereco || "").trim();
    var cep = String(data.cep || "").trim();
    var instituicao = String(data.instituicao || "").trim();
    var pagamento = (data.pagamento || [])
      .map(function (linha) {
        return '<p class="line">' + esc(linha) + "</p>";
      })
      .join("");
    return (
      '<div class="ticket cdr-print">' +
      '<img class="logo" src="' + esc(logo) + '" alt="AMPLIGUARD" />' +
      '<p class="title">RECIBO</p>' +
      '<p class="sigla">PRESTAÇÃO DE SERVIÇOS</p>' +
      '<p class="sec">DADOS DO RECIBO</p>' +
      '<p class="line">Nº do recibo: ' + esc(reciboTexto(data.numero)) + "</p>" +
      '<p class="line">Data de emissão: ' + esc(reciboTexto(data.emissao)) + "</p>" +
      '<hr class="sep" />' +
      '<p class="sec">DADOS DO TOMADOR</p>' +
      '<p class="line">Nome / Razão social: ' + esc(reciboTexto(data.nome)) + "</p>" +
      '<p class="line">CPF / CNPJ: ' + esc(reciboTexto(data.documento)) + "</p>" +
      (endereco ? '<p class="line">Endereço: ' + esc(endereco) + "</p>" : "") +
      (cep ? '<p class="line">CEP: ' + esc(cep) + "</p>" : "") +
      '<hr class="sep" />' +
      '<p class="sec">DADOS DO VEÍCULO</p>' +
      '<p class="line hot">RPP: ' + esc(reciboTexto(data.rpp)) + "</p>" +
      '<p class="line hot-placa">Placa: ' + esc(reciboTexto(data.placa)) + "</p>" +
      '<p class="line">Veículo: ' + esc(reciboTexto(data.veiculo)) + "</p>" +
      '<p class="line">Cor: ' + esc(reciboTexto(data.cor)) + "</p>" +
      (instituicao ? '<p class="line">Instituição financeira: ' + esc(instituicao) + "</p>" : "") +
      '<p class="line">Data de Entrada: ' + esc(reciboTexto(data.entrada)) + "</p>" +
      '<p class="line">Data de Saída: ' + esc(reciboTexto(data.saida)) + "</p>" +
      '<p class="line">Período: ' + esc(reciboTexto(data.periodo)) + "</p>" +
      '<p class="line">Quantidade: ' + esc(reciboTexto(data.quantidade)) + "</p>" +
      '<hr class="sep" />' +
      '<p class="sec">DESCRIÇÃO DOS SERVIÇOS</p>' +
      '<p class="line">' + esc(data.descricao || DESCRICAO_SERVICO) + "</p>" +
      '<p class="line">Valor unitário: ' + esc(reciboTexto(data.valorUnitario)) + "</p>" +
      '<p class="total">VALOR TOTAL: ' + esc(reciboTexto(data.valorTotal)) + "</p>" +
      '<p class="line">Valor por extenso: ' + esc(reciboTexto(data.totalExtenso)) + "</p>" +
      '<hr class="sep" />' +
      '<p class="sec">DADOS PARA PAGAMENTO</p>' +
      pagamento +
      '<hr class="sep" />' +
      '<p class="sec">INFORMAÇÕES ADICIONAIS / OBSERVAÇÕES</p>' +
      '<p class="line obs">' + esc(obs) + "</p>" +
      '<hr class="sep" />' +
      '<div class="sign-block">' +
      '<div class="sign-space"></div>' +
      '<hr class="sign-line" />' +
      '<p class="sign-label">RESPONSÁVEL PELO PÁTIO — AMPLIGUARD</p>' +
      (nomePatio ? '<p class="sign-meta">Nome: ' + esc(nomePatio) + "</p>" : "") +
      (cpfPatio ? '<p class="sign-meta">CPF: ' + esc(cpfPatio) + "</p>" : "") +
      "</div>" +
      '<hr class="sep" />' +
      '<p class="foot-brand">AMPLIGUARD</p>' +
      '<p class="foot-tag">Guarda, Custódia e Remoção de Veículos</p>' +
      "</div>"
    );
  }

  var root = typeof window !== "undefined" ? window : globalThis;
  root.reciboFormatMoeda = moeda;
  root.reciboValorPorExtenso = valorPorExtenso;
  root.reciboDocumentoCss = css;
  root.reciboCdrExtraCss = reciboCdrExtraCss;
  root.buildReciboCdrBody = buildReciboCdrBody;
  root.buildReciboCdrBlocks = buildReciboCdrBlocks;
  root.buildReciboAmpliguardSheet = function (data, imagem) {
    return "<style>" + css() + "</style>" + sheetHtml(data, imagem);
  };
  root.buildReciboAmpliguardHtml = function (data, imagem) {
    return printHtml(data, imagem);
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      valorPorExtenso: valorPorExtenso,
      buildReciboAmpliguardSheet: root.buildReciboAmpliguardSheet,
      buildReciboCdrBody: buildReciboCdrBody,
      buildReciboCdrBlocks: buildReciboCdrBlocks,
      reciboCdrExtraCss: reciboCdrExtraCss,
    };
  }
})();
