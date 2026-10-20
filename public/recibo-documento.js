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

  var UNIDADES = ["", "UM", "DOIS", "TRÊS", "QUATRO", "CINCO", "SEIS", "SETE", "OITO", "NOVE"];
  var DEZ_A_DEZENOVE = ["DEZ", "ONZE", "DOZE", "TREZE", "QUATORZE", "QUINZE", "DEZESSEIS", "DEZESSETE", "DEZOITO", "DEZENOVE"];
  var DEZENAS = ["", "", "VINTE", "TRINTA", "QUARENTA", "CINQUENTA", "SESSENTA", "SETENTA", "OITENTA", "NOVENTA"];
  var CENTENAS = ["", "CENTO", "DUZENTOS", "TREZENTOS", "QUATROCENTOS", "QUINHENTOS", "SEISCENTOS", "SETECENTOS", "OITOCENTOS", "NOVECENTOS"];

  function extensoAte999(n) {
    if (n === 0) return "";
    if (n === 100) return "CEM";
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
    return partes.join(" E ");
  }

  function extensoInteiro(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return "ZERO";
    if (n > 999999999) return String(n);
    var milhoes = Math.floor(n / 1000000);
    var milhares = Math.floor((n % 1000000) / 1000);
    var resto = n % 1000;
    var partes = [];
    if (milhoes) partes.push(extensoAte999(milhoes) + (milhoes === 1 ? " MILHÃO" : " MILHÕES"));
    if (milhares) partes.push((milhares === 1 ? "MIL" : extensoAte999(milhares) + " MIL"));
    if (resto) partes.push(extensoAte999(resto));
    return partes.join(" E ");
  }

  function valorPorExtenso(value) {
    var n = Number(value);
    if (!Number.isFinite(n) || n < 0) n = 0;
    n = Math.round(n * 100) / 100;
    var inteiro = Math.floor(n + 1e-8);
    var centavos = Math.round((n - inteiro) * 100);
    var texto = extensoInteiro(inteiro) + (inteiro === 1 ? " REAL" : " REAIS");
    if (centavos > 0) {
      texto += " E " + extensoInteiro(centavos) + (centavos === 1 ? " CENTAVO" : " CENTAVOS");
    }
    return texto;
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
      "text-transform:" + (opts.upper ? "uppercase" : "none"),
    ].join(";");
    return '<div class="rv" style="' + style + '">' + esc(text || "") + "</div>";
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
      { x: 742, y: 598, w: 130, h: 16, size: 8, weight: 600, align: "center", color: "#d5dde8", bg: NAVY, tracking: "0.12em" },
      data.totalExtenso
    );
    return (
      '<div class="ag-recibo">' +
      '<img class="ag-recibo-bg" src="' +
      esc(imagem || MODELO) +
      '" alt="" />' +
      html +
      "</div>"
    );
  }

  function css() {
    return (
      "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&display=swap');" +
      ".ag-recibo{position:relative;width:1024px;height:682px;overflow:hidden;background:#fff;font-family:Montserrat,Arial,Helvetica,sans-serif;}" +
      ".ag-recibo-bg{position:absolute;left:0;top:0;width:1024px;height:682px;display:block;}" +
      ".ag-recibo .rv{position:absolute;z-index:1;box-sizing:border-box;display:flex;align-items:center;margin:0;padding:0 2px;line-height:1;white-space:nowrap;overflow:hidden;font-family:Montserrat,Arial,Helvetica,sans-serif;}"
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
      ".ag-recibo{zoom:1.0962;margin:6.1mm 0 0 0;}}</style></head><body>" +
      sheetHtml(data, imagem) +
      "</body></html>"
    );
  }

  window.reciboFormatMoeda = moeda;
  window.reciboValorPorExtenso = valorPorExtenso;
  window.reciboDocumentoCss = css;
  window.buildReciboAmpliguardSheet = function (data, imagem) {
    return "<style>" + css() + "</style>" + sheetHtml(data, imagem);
  };
  window.buildReciboAmpliguardHtml = function (data, imagem) {
    return printHtml(data, imagem);
  };
})();
