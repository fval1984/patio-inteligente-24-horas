/**
 * PNG do QR Code público + placa visual AMPLIGUARD (lado a lado). Sem etiqueta extra, sem impressão.
 */
(function (global) {
  const BLACK = "#000000";
  const WHITE = "#ffffff";
  const QR_INNER = 1100;
  const QUIET = 110;
  const GAP = 90;
  const OUTER = 90;
  const QR_SRC = "/vendor/qrcode.min.js?v=20261005recibo1";
  const H2C_SRC = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

  function publicHistoryUrl(token) {
    const origin = typeof location !== "undefined" ? location.origin : "";
    return `${origin}/v/${String(token || "").trim()}`;
  }

  function db() {
    return global.supabaseClient || (typeof supabase !== "undefined" ? supabase : null);
  }

  async function ensureQrLib() {
    if (global.QRCode && global.QRCode.CorrectLevel) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = QR_SRC;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("qrcode"));
      document.head.appendChild(s);
    });
  }

  async function ensureHtml2Canvas() {
    if (typeof global.loadHtml2Canvas === "function") return global.loadHtml2Canvas();
    if (global.html2canvas) return global.html2canvas;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = H2C_SRC;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("html2canvas"));
      document.head.appendChild(s);
    });
    if (!global.html2canvas) throw new Error("html2canvas");
    return global.html2canvas;
  }

  async function renderQrInnerCanvas(text) {
    await ensureQrLib();
    const holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:fixed;left:-9999px;top:0;";
    document.body.appendChild(holder);
    new global.QRCode(holder, {
      text,
      width: QR_INNER,
      height: QR_INNER,
      colorDark: BLACK,
      colorLight: WHITE,
      correctLevel: global.QRCode.CorrectLevel.M,
    });
    const src = holder.querySelector("canvas");
    const canvas = document.createElement("canvas");
    canvas.width = QR_INNER;
    canvas.height = QR_INNER;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, QR_INNER, QR_INNER);
    if (src) ctx.drawImage(src, 0, 0, QR_INNER, QR_INNER);
    holder.remove();
    return canvas;
  }

  function plateHtml(placa) {
    if (global.vehiclePlateUI && typeof global.vehiclePlateUI.renderHtml === "function") {
      return global.vehiclePlateUI.renderHtml(placa, { size: "lg", showEmpty: true, wrap: true });
    }
    const t = String(placa || "—");
    return `<span class="vp-plate-wrap"><span class="vp-plate">${t}</span></span>`;
  }

  async function capturePlateCanvas(placa) {
    const h2c = await ensureHtml2Canvas();
    const holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText =
      "position:fixed;left:-9999px;top:0;background:#ffffff;padding:12px;z-index:-1;";
    holder.innerHTML = plateHtml(placa);
    document.body.appendChild(holder);
    const node = holder.querySelector(".vp-plate") || holder;
    try {
      return await h2c(node, {
        backgroundColor: "#ffffff",
        scale: 5,
        useCORS: true,
        logging: false,
      });
    } finally {
      holder.remove();
    }
  }

  function composeQrAndPlate(qrCanvas, plateCanvas) {
    const qrBlock = QR_INNER + QUIET * 2;
    const plateNatW = Math.max(1, plateCanvas.width);
    const plateNatH = Math.max(1, plateCanvas.height);
    const plateH = Math.round(QR_INNER * 0.58);
    const plateW = Math.round((plateH * plateNatW) / plateNatH);
    const contentH = Math.max(qrBlock, plateH);
    const width = OUTER * 2 + qrBlock + GAP + plateW;
    const height = OUTER * 2 + contentH;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, width, height);

    const qrX = OUTER + QUIET;
    const qrY = OUTER + Math.round((contentH - QR_INNER) / 2);
    ctx.drawImage(qrCanvas, qrX, qrY, QR_INNER, QR_INNER);

    const plateX = OUTER + qrBlock + GAP;
    const plateY = OUTER + Math.round((contentH - plateH) / 2);
    ctx.drawImage(plateCanvas, plateX, plateY, plateW, plateH);
    return canvas;
  }

  async function ensureTokenViaApi(vehicle) {
    const client = db();
    let accessToken = "";
    try {
      const sessionRes = client && client.auth && (await client.auth.getSession());
      accessToken =
        (sessionRes && sessionRes.data && sessionRes.data.session && sessionRes.data.session.access_token) || "";
    } catch (e) {}
    const res = await fetch("/api/vehicles/ensure-public-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ vehicle_id: vehicle.id, access_token: accessToken }),
    });
    const json = await res.json().catch(() => ({}));
    if (json && json.public_token) return String(json.public_token);
    throw new Error(
      (json && json.error) ||
        "Não foi possível gerar o QR Code. No Supabase → SQL Editor, execute supabase/vehicles_public_qr.sql e clique em Run."
    );
  }

  async function ensureToken(vehicle) {
    if (vehicle && vehicle.public_token) return String(vehicle.public_token);
    const client = db();
    if (!vehicle || !vehicle.id) {
      throw new Error("Registro sem identificador público. Execute supabase/vehicles_public_qr.sql.");
    }
    if (client) {
      const { data, error } = await client.rpc("ensure_vehicle_public_token", { p_vehicle_id: vehicle.id });
      if (!error && data) {
        vehicle.public_token = data;
        return String(data);
      }
    }
    const token = await ensureTokenViaApi(vehicle);
    vehicle.public_token = token;
    return token;
  }

  function downloadCanvas(canvas, filename) {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  }

  async function downloadForVehicle(vehicle) {
    if (!vehicle) return;
    const token = await ensureToken(vehicle);
    const qrCanvas = await renderQrInnerCanvas(publicHistoryUrl(token));
    const plateCanvas = await capturePlateCanvas(vehicle.placa);
    const canvas = composeQrAndPlate(qrCanvas, plateCanvas);
    const placa = String(vehicle.placa || "veiculo").replace(/\s+/g, "");
    downloadCanvas(canvas, `ampliguard-qr-${placa}.png`);
  }

  global.vehicleQr = {
    publicHistoryUrl,
    ensureToken,
    downloadForVehicle,
  };
  global.vehicleLabels = {
    openForVehicle: downloadForVehicle,
    downloadForVehicle,
  };
})(typeof window !== "undefined" ? window : globalThis);
