/**
 * Etiquetas AMPLIGUARD em PNG para o aplicativo NIIMBOT B1.
 * Não imprime pelo navegador. O QR público permanece o mesmo no registro.
 */
(function (global) {
  const NIIMBOT_DPI = 203;
  const EXPORT_SCALE = 3;
  const DPI = NIIMBOT_DPI * EXPORT_SCALE;
  const BLACK = "#000000";
  const WHITE = "#ffffff";
  const CNPJ = "57.936.119/0001-98";
  const TAGLINE = "GUARDA E CUSTÓDIA DE BENS";
  const LOGO_OFFICIAL = "/assets/ampliguard-logo-official.png?v=20261109qr2";
  const LOGO_MARCA = "/assets/ampliguard-marca.png?v=20260917logo2";
  const QR_SRC = "/vendor/qrcode.min.js?v=20261005recibo1";

  const WINDSHIELD = { wMm: 50, hMm: 30 };
  const KEY = { wMm: 25, hMm: 30 };

  let logoImg = null;
  let modalBound = false;

  function mmToPx(mm) {
    return Math.round((Number(mm) / 25.4) * DPI);
  }

  function publicHistoryUrl(token) {
    const origin = typeof location !== "undefined" ? location.origin : "";
    return `${origin}/v/${String(token || "").trim()}`;
  }

  function formatEntryLabel(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (e) {
      return "";
    }
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

  async function getLogo() {
    if (logoImg) return logoImg;
    try {
      logoImg = await loadImage(LOGO_OFFICIAL);
    } catch (e) {
      logoImg = await loadImage(LOGO_MARCA);
    }
    return logoImg;
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
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
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

  function fillCentered(ctx, text, y, fontPx, weight) {
    ctx.fillStyle = BLACK;
    ctx.font = `${weight || 700} ${fontPx}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, ctx.canvas.width / 2, y);
  }

  async function renderWindshield(vehicle, token) {
    const { canvas, ctx, w, h } = makeCanvas(WINDSHIELD.wMm, WINDSHIELD.hMm);
    const logo = await getLogo();
    const qrSize = mmToPx(12.4);
    const qr = await qrImage(publicHistoryUrl(token), qrSize);
    drawContain(ctx, logo, mmToPx(4), mmToPx(1.1), w - mmToPx(8), mmToPx(6.4));
    fillCentered(ctx, plateText(vehicle), mmToPx(9.4), mmToPx(4.4), 800);
    fillCentered(ctx, formatEntryLabel(vehicle.data_entrada) || "", mmToPx(13.1), mmToPx(2.15), 600);
    ctx.drawImage(qr, (w - qrSize) / 2, mmToPx(15.4), qrSize, qrSize);
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
    const qrSize = mmToPx(16.2);
    const qr = await qrImage(publicHistoryUrl(token), qrSize);
    ctx.drawImage(qr, (w - qrSize) / 2, (h - qrSize) / 2, qrSize, qrSize);
    drawVerticalPlate(ctx, plate, mmToPx(2.15), h / 2, mmToPx(2.35), -Math.PI / 2);
    drawVerticalPlate(ctx, plate, w - mmToPx(2.15), h / 2, mmToPx(2.35), Math.PI / 2);
    return canvas;
  }

  async function renderKeyBack(vehicle) {
    const { canvas, ctx, w } = makeCanvas(KEY.wMm, KEY.hMm);
    const logo = await getLogo();
    drawContain(ctx, logo, mmToPx(2.2), mmToPx(4.2), w - mmToPx(4.4), mmToPx(14.5));
    fillCentered(ctx, TAGLINE, mmToPx(21.2), mmToPx(1.55), 700);
    fillCentered(ctx, `CNPJ: ${CNPJ}`, mmToPx(24.4), mmToPx(1.7), 700);
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

  async function ensureToken(vehicle) {
    if (vehicle && vehicle.public_token) return String(vehicle.public_token);
    const client = db();
    if (!client || !vehicle || !vehicle.id) {
      throw new Error("Registro sem identificador público. Execute supabase/vehicles_public_qr.sql.");
    }
    const { data, error } = await client.rpc("ensure_vehicle_public_token", { p_vehicle_id: vehicle.id });
    if (!error && data) {
      vehicle.public_token = data;
      return String(data);
    }
    throw new Error(
      (error && error.message) ||
        "Não foi possível gerar o QR Code. Execute supabase/vehicles_public_qr.sql no Supabase."
    );
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
    slot.appendChild(img);
  }

  async function buildCanvases(vehicle, token) {
    const wind = await renderWindshield(vehicle, token);
    const keyFront = await renderKeyFront(vehicle, token);
    const keyBack = await renderKeyBack(vehicle);
    return { wind, keyFront, keyBack };
  }

  async function fillPreviews(vehicle, token) {
    const canvases = await buildCanvases(vehicle, token);
    showPreview(canvases.wind, "vlPreviewWindshield", "220px");
    showPreview(canvases.keyFront, "vlPreviewKeyFront", "110px");
    showPreview(canvases.keyBack, "vlPreviewKeyBack", "110px");
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
    if (kind === "keyFront") downloadCanvas(pack.canvases.keyFront, fileName(pack.vehicle, "chave-frente-25x30"));
    if (kind === "keyBack") downloadCanvas(pack.canvases.keyBack, fileName(pack.vehicle, "chave-verso-25x30"));
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
    formatEntryLabel,
    ensureToken,
    openForVehicle,
    currentVehicleFromState,
    downloadKind,
    sizes: { DPI, NIIMBOT_DPI, WINDSHIELD, KEY },
  };
})(typeof window !== "undefined" ? window : globalThis);
