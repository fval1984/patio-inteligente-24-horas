/**
 * Pix Copia e Cola da Ficha Tipo 2.
 * Usa a chave CNPJ já impressa nas cobranças AMPLIGUARD e o valor de calcTotal.
 * Não cria cobrança no banco nem dá baixa financeira.
 */
(function vehicleFichaTipo2Pix(global) {
  "use strict";

  const PIX_CHAVE_CNPJ = "57936119000198";
  const PIX_NOME = "AMPLIGUARD GUARDA E CUST";
  const PIX_CIDADE = "RECIFE";

  function tlv(id, value) {
    const v = String(value == null ? "" : value);
    return String(id).padStart(2, "0") + String(v.length).padStart(2, "0") + v;
  }

  function crc16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function sanitize(text, max) {
    const s = String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 ./-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    return s.slice(0, max);
  }

  function parseTlvs(raw, stopAtCrc) {
    const s = String(raw || "");
    const map = {};
    let i = 0;
    while (i + 4 <= s.length) {
      const id = s.slice(i, i + 2);
      const len = Number(s.slice(i + 2, i + 4));
      if (!Number.isInteger(len) || len < 0 || i + 4 + len > s.length) return null;
      map[id] = s.slice(i + 4, i + 4 + len);
      i += 4 + len;
      if (stopAtCrc && id === "63") break;
    }
    return map;
  }

  function buildPayload(amount, descricao) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return "";
    const amountStr = n.toFixed(2);
    const maii =
      tlv("00", "br.gov.bcb.pix") +
      tlv("01", PIX_CHAVE_CNPJ) +
      tlv("02", sanitize(descricao || "AMPLIGUARD", 72) || "AMPLIGUARD");
    const body =
      tlv("00", "01") +
      tlv("01", "11") +
      tlv("26", maii) +
      tlv("52", "0000") +
      tlv("53", "986") +
      tlv("54", amountStr) +
      tlv("58", "BR") +
      tlv("59", sanitize(PIX_NOME, 25) || "AMPLIGUARD") +
      tlv("60", sanitize(PIX_CIDADE, 15) || "RECIFE") +
      tlv("62", tlv("05", "***")) +
      "6304";
    return body + crc16(body);
  }

  function validate(payload, expectedAmount) {
    const text = String(payload || "").trim();
    if (text.length < 70 || text.length > 512) return { ok: false, reason: "tamanho" };
    if (!text.startsWith("000201")) return { ok: false, reason: "formato" };
    if (text.slice(-4) !== crc16(text.slice(0, -4))) return { ok: false, reason: "crc" };
    const root = parseTlvs(text, true);
    if (!root) return { ok: false, reason: "tlv" };
    const maii = parseTlvs(root["26"] || "", false);
    if (!maii || String(maii["00"] || "").toLowerCase() !== "br.gov.bcb.pix") {
      return { ok: false, reason: "gui" };
    }
    if (String(maii["01"] || "").replace(/\D/g, "") !== PIX_CHAVE_CNPJ) {
      return { ok: false, reason: "chave" };
    }
    const amountStr = String(root["54"] || "");
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0 || amountStr !== Number(expectedAmount).toFixed(2)) {
      return { ok: false, reason: "valor" };
    }
    if (String(root["53"] || "") !== "986") return { ok: false, reason: "moeda" };
    return { ok: true, amount, payload: text };
  }

  async function ensureQrLib() {
    if (global.QRCode && global.QRCode.CorrectLevel) return;
    if (typeof global.comprovanteEnsureQrLib === "function") {
      await global.comprovanteEnsureQrLib();
      return;
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/vendor/qrcode.min.js?v=20261005recibo1";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("qrcode"));
      document.head.appendChild(s);
    });
  }

  async function qrDataUrl(payload) {
    const text = String(payload || "").trim();
    if (!text) return "";
    try {
      await ensureQrLib();
      const holder = document.createElement("div");
      holder.setAttribute("aria-hidden", "true");
      holder.style.cssText = "position:fixed;left:-9999px;top:0;width:220px;height:220px;";
      document.body.appendChild(holder);
      new global.QRCode(holder, {
        text,
        width: 220,
        height: 220,
        colorDark: "#14221c",
        colorLight: "#ffffff",
        correctLevel: global.QRCode.CorrectLevel.M,
      });
      const canvas = holder.querySelector("canvas");
      const url = canvas ? canvas.toDataURL("image/png") : "";
      holder.remove();
      return url || "";
    } catch (e) {
      console.warn("qr pix ficha 2", e);
      return "";
    }
  }

  global.vehicleFichaTipo2Pix = {
    chaveCnpj: PIX_CHAVE_CNPJ,
    buildPayload,
    validate,
    qrDataUrl,
  };
})(typeof window !== "undefined" ? window : this);
