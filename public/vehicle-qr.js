/**
 * PNG do QR Code público do registro. Sem etiqueta, sem impressão.
 */
(function (global) {
  const BLACK = "#000000";
  const WHITE = "#ffffff";
  const PNG_SIZE = 1200;
  const QUIET = 120;
  const QR_SRC = "/vendor/qrcode.min.js?v=20261005recibo1";

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

  async function renderQrPng(text) {
    await ensureQrLib();
    const inner = PNG_SIZE - QUIET * 2;
    const holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:fixed;left:-9999px;top:0;";
    document.body.appendChild(holder);
    new global.QRCode(holder, {
      text,
      width: inner,
      height: inner,
      colorDark: BLACK,
      colorLight: WHITE,
      correctLevel: global.QRCode.CorrectLevel.M,
    });
    const src = holder.querySelector("canvas");
    const canvas = document.createElement("canvas");
    canvas.width = PNG_SIZE;
    canvas.height = PNG_SIZE;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
    if (src) ctx.drawImage(src, QUIET, QUIET, inner, inner);
    holder.remove();
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
    const canvas = await renderQrPng(publicHistoryUrl(token));
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
