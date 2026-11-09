/**
 * Etiquetas AMPLIGUARD em PNG para o aplicativo NIIMBOT B1 Series.
 * Só download. Sem impressão no navegador.
 */
(function (global) {
  const DPI = 600;
  const BLACK = "#000000";
  const WHITE = "#ffffff";
  const CNPJ = "57.936.119/0001-98";
  const TAGLINE = "GUARDA E CUSTÓDIA DE BENS";
  const LOGO_OFFICIAL = "/assets/ampliguard-logo-official.png?v=20261109qr4";
  const LOGO_MARCA = "/assets/ampliguard-marca.png?v=20260917logo2";
  const QR_SRC = "/vendor/qrcode.min.js?v=20261005recibo1";

  const WINDSHIELD = { wMm: 50, hMm: 30 };
  const KEY = { wMm: 25, hMm: 30 };

  let logoInk = null;
  let modalBound = false;

  function mmToPx(mm) {
    return Math.round((Number(mm) / 25.4) * DPI);
  }

  function publicHistoryUrl(token) {
    const origin = typeof location !== "undefined" ? location.origin : "";
    return `${origin}/v/${String(token || "").trim()}`;
  }

  function plateText(vehicle) {
    return String((vehicle && vehicle.placa) || "").trim().toUpperCase() || "—";
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

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(src));
      img.src = src;
    });
  }

  function logoToBlackInk(img) {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const cropH = Math.max(1, Math.round(srcH * 0.66));
    const canvas = document.createElement("canvas");
    canvas.width = srcW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, srcW, cropH);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      if (lum < 70) {
        px[i + 3] = 0;
      } else {
        px[i] = 0;
        px[i + 1] = 0;
        px[i + 2] = 0;
        px[i + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    const thick = document.createElement("canvas");
    thick.width = srcW;
    thick.height = cropH;
    const tctx = thick.getContext("2d");
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      tctx.drawImage(canvas, dx, dy);
    });
    return thick;
  }

  async function getLogoInk() {
    if (logoInk) return logoInk;
    let img;
    try {
      img = await loadImage(LOGO_OFFICIAL);
    } catch (e) {
      img = await loadImage(LOGO_MARCA);
    }
    logoInk = logoToBlackInk(img);
    return logoInk;
  }

  async function qrImage(text, size) {
    await ensureQrLib();
    const holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:fixed;left:-9999px;top:0;";
    document.body.appendChild(holder);
    new global.QRCode(holder, {
      text,
      width: size,
      height: size,
      colorDark: BLACK,
      colorLight: WHITE,
      correctLevel: global.QRCode.CorrectLevel.M,
    });
    const canvas = holder.querySelector("canvas");
    const url = canvas ? canvas.toDataURL("image/png") : "";
    holder.remove();
    if (!url) throw new Error("qr");
    return loadImage(url);
  }

  function drawContain(ctx, img, x, y, w, h) {
    const iw = img.width || img.naturalWidth;
    const ih = img.height || img.naturalHeight;
    if (!iw || !ih) return;
    const scale = Math.min(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function makeCanvas(wMm, hMm) {
    const canvas = document.createElement("canvas");
    canvas.width = mmToPx(wMm);
    canvas.height = mmToPx(hMm);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return { canvas, ctx, w: canvas.width, h: canvas.height };
  }

  function fillTracked(ctx, text, cx, y, fontPx, tracking) {
    ctx.fillStyle = BLACK;
    ctx.font = `600 ${fontPx}px Arial, Helvetica, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const chars = String(text).split("");
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const gap = fontPx * (tracking == null ? 0.14 : tracking);
    let total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, chars.length - 1);
    let x = cx - total / 2;
    chars.forEach((ch, i) => {
      ctx.fillText(ch, x, y);
      x += widths[i] + gap;
    });
  }

  function fillCentered(ctx, text, y, fontPx, weight) {
    ctx.fillStyle = BLACK;
    ctx.font = `${weight || 700} ${fontPx}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, ctx.canvas.width / 2, y);
  }

  async function renderWindshield(vehicle, token) {
    const { canvas, ctx, w } = makeCanvas(WINDSHIELD.wMm, WINDSHIELD.hMm);
    const logo = await getLogoInk();
    drawContain(ctx, logo, mmToPx(2.6), mmToPx(0.9), w - mmToPx(5.2), mmToPx(8.6));
    fillTracked(ctx, TAGLINE, w / 2, mmToPx(10.5), mmToPx(1.58), 0.18);
    fillCentered(ctx, `CNPJ: ${CNPJ}`, mmToPx(13.15), mmToPx(1.9), 700);
    const qrSize = mmToPx(14.6);
    const qr = await qrImage(publicHistoryUrl(token), qrSize);
    ctx.drawImage(qr, (w - qrSize) / 2, mmToPx(14.6), qrSize, qrSize);
    return canvas;
  }

  function drawVerticalPlate(ctx, plate, x, y, fontPx, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = BLACK;
    ctx.font = `700 ${fontPx}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(plate, 0, 0);
    ctx.restore();
  }

  async function renderKeyFront(vehicle, token) {
    const { canvas, ctx, w, h } = makeCanvas(KEY.wMm, KEY.hMm);
    const plate = plateText(vehicle);
    const qrSize = mmToPx(17.6);
    const qr = await qrImage(publicHistoryUrl(token), qrSize);
    ctx.drawImage(qr, (w - qrSize) / 2, (h - qrSize) / 2, qrSize, qrSize);
    drawVerticalPlate(ctx, plate, mmToPx(1.95), h / 2, mmToPx(2.45), -Math.PI / 2);
    drawVerticalPlate(ctx, plate, w - mmToPx(1.95), h / 2, mmToPx(2.45), Math.PI / 2);
    return canvas;
  }

  async function renderKeyBack() {
    const { canvas, ctx, w, h } = makeCanvas(KEY.wMm, KEY.hMm);
    const logo = await getLogoInk();
    drawContain(ctx, logo, mmToPx(1.4), mmToPx(5.4), w - mmToPx(2.8), mmToPx(12.4));
    fillTracked(ctx, TAGLINE, w / 2, mmToPx(19.8), mmToPx(1.18), 0.08);
    fillCentered(ctx, `CNPJ: ${CNPJ}`, mmToPx(22.8), mmToPx(1.32), 700);
    void h;
    return canvas;
  }

  function downloadCanvas(canvas, filename) {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  }

  function fileName(vehicle, kind) {
    const placa = String((vehicle && vehicle.placa) || "veiculo").replace(/\s+/g, "");
    return `ampliguard-${kind}-${placa}.png`;
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

  function showPreview(canvas, slotId, maxCss) {
    const slot = document.getElementById(slotId);
    if (!slot) return;
    slot.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "Pré-visualização da etiqueta";
    img.src = canvas.toDataURL("image/png");
    img.style.width = maxCss;
    img.style.height = "auto";
    img.style.background = "#fff";
    slot.appendChild(img);
  }

  async function buildCanvases(vehicle, token) {
    const wind = await renderWindshield(vehicle, token);
    const keyFront = await renderKeyFront(vehicle, token);
    const keyBack = await renderKeyBack();
    return { wind, keyFront, keyBack };
  }

  async function fillPreviews(vehicle, token) {
    const canvases = await buildCanvases(vehicle, token);
    showPreview(canvases.wind, "vlPreviewWindshield", "250px");
    showPreview(canvases.keyFront, "vlPreviewKeyFront", "125px");
    showPreview(canvases.keyBack, "vlPreviewKeyBack", "125px");
    const urlEl = document.getElementById("vlPublicUrl");
    if (urlEl) urlEl.value = publicHistoryUrl(token);
    return canvases;
  }

  function currentVehicleFromState(id) {
    const list = (global.__ampliState && global.__ampliState.vehicles) || [];
    return list.find((v) => String(v.id) === String(id)) || null;
  }

  async function openForVehicle(vehicle) {
    if (!vehicle) return;
    const modal = document.getElementById("vehicleLabelsModal");
    if (!modal) return;
    bindModalOnce();
    modal.dataset.vehicleId = vehicle.id;
    const title = document.getElementById("vehicleLabelsTitle");
    if (title) title.textContent = `Etiquetas — ${vehicle.placa || "veículo"}`;
    modal.classList.remove("hidden");
    try {
      const token = await ensureToken(vehicle);
      const canvases = await fillPreviews(vehicle, token);
      modal._vl = { vehicle, token, canvases };
    } catch (e) {
      alert(e && e.message ? e.message : "Não foi possível preparar as etiquetas.");
    }
  }

  function downloadKind(kind) {
    const modal = document.getElementById("vehicleLabelsModal");
    const pack = modal && modal._vl;
    if (!pack || !pack.canvases) return;
    if (kind === "wind") downloadCanvas(pack.canvases.wind, fileName(pack.vehicle, "parabrisa-50x30"));
    if (kind === "keyFront") downloadCanvas(pack.canvases.keyFront, fileName(pack.vehicle, "chave-qr-25x30"));
    if (kind === "keyBack") downloadCanvas(pack.canvases.keyBack, fileName(pack.vehicle, "chave-logo-25x30"));
  }

  function bindModalOnce() {
    if (modalBound) return;
    modalBound = true;
    const modal = document.getElementById("vehicleLabelsModal");
    const close = () => modal && modal.classList.add("hidden");
    document.getElementById("closeVehicleLabelsModal")?.addEventListener("click", close);
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.getElementById("vlDownloadWindshield")?.addEventListener("click", () => downloadKind("wind"));
    document.getElementById("vlDownloadKeyFront")?.addEventListener("click", () => downloadKind("keyFront"));
    document.getElementById("vlDownloadKeyBack")?.addEventListener("click", () => downloadKind("keyBack"));
    document.getElementById("vlCopyUrl")?.addEventListener("click", async () => {
      const el = document.getElementById("vlPublicUrl");
      const text = el && el.value;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        alert("Endereço público copiado.");
      } catch (e) {
        if (el) {
          el.focus();
          el.select();
        }
      }
    });
  }

  global.vehicleLabels = {
    mmToPx,
    publicHistoryUrl,
    ensureToken,
    openForVehicle,
    currentVehicleFromState,
    downloadKind,
    buildCanvases,
    sizes: { DPI, WINDSHIELD, KEY },
  };
})(typeof window !== "undefined" ? window : globalThis);
