/**
 * PNG: placa em texto vertical (esquerda) + QR do registro (direita).
 * Sem etiqueta, sem impressão, sem logotipo.
 */
(function (global) {
  const BLACK = "#000000";
  const WHITE = "#ffffff";
  const QR_INNER = 1100;
  const QUIET = 90;
  const OUTER = 70;
  const GAP = 36;
  const QR_SRC = "/vendor/qrcode.min.js?v=20261005recibo1";

  function publicHistoryUrl(token) {
    const origin = typeof location !== "undefined" ? location.origin : "";
    return `${origin}/v/${String(token || "").trim()}`;
  }

  function db() {
    return global.supabaseClient || (typeof supabase !== "undefined" ? supabase : null);
  }

  function plateLabel(placa) {
    const ui = global.vehiclePlateUI;
    if (ui && typeof ui.analyzePlate === "function") {
      const info = ui.analyzePlate(placa);
      const shown = String((info && info.display) || placa || "")
        .trim()
        .toUpperCase();
      return shown || "—";
    }
    const clean = String(placa || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (/^[A-Z]{3}[0-9]{4}$/.test(clean)) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    return clean || "—";
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

  function composePlateAndQr(qrCanvas, placa) {
    const label = plateLabel(placa);
    const qrBlock = QR_INNER + QUIET * 2;
    const measure = document.createElement("canvas").getContext("2d");
    let fontPx = Math.round(QR_INNER * 0.16);
    measure.font = `900 ${fontPx}px Arial, Helvetica, sans-serif`;
    while (measure.measureText(label).width > QR_INNER * 0.96 && fontPx > 28) {
      fontPx -= 2;
      measure.font = `900 ${fontPx}px Arial, Helvetica, sans-serif`;
    }
    const plateCol = Math.ceil(fontPx * 1.15);
    const width = OUTER * 2 + plateCol + GAP + qrBlock;
    const height = OUTER * 2 + qrBlock;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, width, height);

    const qrX = OUTER + plateCol + GAP + QUIET;
    const qrY = OUTER + QUIET;
    ctx.drawImage(qrCanvas, qrX, qrY, QR_INNER, QR_INNER);

    const colX = OUTER + plateCol / 2;
    const colY = OUTER + qrBlock / 2;
    ctx.save();
    ctx.translate(colX, colY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = BLACK;
    ctx.font = `900 ${fontPx}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 0);
    ctx.restore();
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
    const canvas = composePlateAndQr(qrCanvas, vehicle.placa);
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
