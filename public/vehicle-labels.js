/**
 * Etiquetas NIIMBOT B1 (203 dpi) e QR Code público do registro.
 * Não altera o fluxo de cadastro; só gera token se ainda não existir.
 */
(function (global) {
  const DPI = 203;
  const LOGO_OFFICIAL = "/assets/ampliguard-logo-official.png?v=20261109qr1";
  const LOGO_MARCA = "/assets/ampliguard-marca.png?v=20260917logo2";
  const QR_SRC = "/vendor/qrcode.min.js?v=20261005recibo1";

  const WINDSHIELD = { wMm: 50, hMm: 30, name: "para-brisa" };
  const KEY = { wMm: 25, hMm: 78, bodyMm: 38, strapMm: 40, name: "chave" };

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

  async function qrDataUrl(text, size) {
    await ensureQrLib();
    const holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:fixed;left:-9999px;top:0;";
    document.body.appendChild(holder);
    new global.QRCode(holder, {
      text,
      width: size,
      height: size,
      colorDark: "#14221c",
      colorLight: "#ffffff",
      correctLevel: global.QRCode.CorrectLevel.M,
    });
    const canvas = holder.querySelector("canvas");
    const url = canvas ? canvas.toDataURL("image/png") : "";
    holder.remove();
    if (!url) throw new Error("qr");
    const img = await loadImage(url);
    return img;
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

  async function renderWindshield(vehicle, token) {
    const w = mmToPx(WINDSHIELD.wMm);
    const h = mmToPx(WINDSHIELD.hMm);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const logo = await getLogo();
    const qrSize = mmToPx(16);
    const pad = mmToPx(1.4);
    const qr = await qrDataUrl(publicHistoryUrl(token), qrSize);
    drawContain(ctx, logo, pad, pad, mmToPx(22), mmToPx(9));
    ctx.fillStyle = "#14221c";
    ctx.font = `700 ${mmToPx(6.2)}px sans-serif`;
    ctx.textBaseline = "top";
    const plate = String(vehicle.placa || "").toUpperCase();
    ctx.fillText(plate, pad, mmToPx(11.2));
    ctx.font = `500 ${mmToPx(2.6)}px sans-serif`;
    ctx.fillStyle = "#3d5a4c";
    ctx.fillText(formatEntryLabel(vehicle.data_entrada) || "Entrada", pad, mmToPx(19.2));
    ctx.fillText("AMPLIGUARD", pad, mmToPx(23.2));
    ctx.drawImage(qr, w - qrSize - pad, (h - qrSize) / 2, qrSize, qrSize);
    ctx.strokeStyle = "#e6eee9";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    return canvas;
  }

  async function renderKey(vehicle, token) {
    const w = mmToPx(KEY.wMm);
    const h = mmToPx(KEY.hMm);
    const strap = mmToPx(KEY.strapMm);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const logo = await getLogo();
    const pad = mmToPx(1.2);
    const holeKeepout = mmToPx(8);
    ctx.save();
    ctx.translate(w / 2, holeKeepout + (strap - holeKeepout) / 2);
    ctx.rotate(-Math.PI / 2);
    const logoBandW = strap - holeKeepout - pad * 2;
    const logoBandH = w - pad * 2;
    drawContain(ctx, logo, -logoBandW / 2, -logoBandH / 2, logoBandW, logoBandH);
    ctx.restore();

    ctx.strokeStyle = "#d8e3dc";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(pad, strap);
    ctx.lineTo(w - pad, strap);
    ctx.stroke();
    ctx.setLineDash([]);

    const bodyY = strap + pad;
    const bodyH = h - strap - pad * 2;
    const plate = String(vehicle.placa || "").toUpperCase();
    ctx.fillStyle = "#14221c";
    ctx.font = `700 ${mmToPx(4.2)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(plate, w / 2, bodyY);
    const qrSize = mmToPx(16);
    const qr = await qrDataUrl(publicHistoryUrl(token), qrSize);
    ctx.drawImage(qr, (w - qrSize) / 2, h - pad - qrSize, qrSize, qrSize);
    ctx.font = `500 ${mmToPx(2.1)}px sans-serif`;
    ctx.fillStyle = "#3d5a4c";
    ctx.fillText("AMPLIGUARD", w / 2, bodyY + mmToPx(6));
    ctx.textAlign = "left";
    void bodyH;
    return canvas;
  }

  function downloadCanvas(canvas, filename) {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  }

  function printCanvas(canvas, wMm, hMm) {
    const url = canvas.toDataURL("image/png");
    const win = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
    if (!win) {
      alert("Permita pop-ups para imprimir a etiqueta.");
      return;
    }
    win.document.write(`<!doctype html><html><head><title>Etiqueta AMPLIGUARD</title>
<style>
  @page { size: ${wMm}mm ${hMm}mm; margin: 0; }
  html, body { margin: 0; padding: 0; width: ${wMm}mm; height: ${hMm}mm; }
  img { width: ${wMm}mm; height: ${hMm}mm; display: block; }
  @media print { html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body><img src="${url}" alt="Etiqueta" /></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch (e) {}
    }, 350);
  }

  function fileName(vehicle, kind) {
    const placa = String(vehicle.placa || "veiculo").replace(/\s+/g, "");
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

  async function fillPreviews(vehicle, token) {
    const wind = await renderWindshield(vehicle, token);
    const key = await renderKey(vehicle, token);
    showPreview(wind, "vlPreviewWindshield", "200px");
    showPreview(key, "vlPreviewKey", "90px");
    const urlEl = document.getElementById("vlPublicUrl");
    if (urlEl) urlEl.value = publicHistoryUrl(token);
    return { wind, key };
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

  function bindModalOnce() {
    if (modalBound) return;
    modalBound = true;
    const modal = document.getElementById("vehicleLabelsModal");
    const close = () => modal && modal.classList.add("hidden");
    document.getElementById("closeVehicleLabelsModal")?.addEventListener("click", close);
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.getElementById("vlPrintWindshield")?.addEventListener("click", () => {
      const pack = modal && modal._vl;
      if (!pack) return;
      printCanvas(pack.canvases.wind, WINDSHIELD.wMm, WINDSHIELD.hMm);
    });
    document.getElementById("vlDownloadWindshield")?.addEventListener("click", () => {
      const pack = modal && modal._vl;
      if (!pack) return;
      downloadCanvas(pack.canvases.wind, fileName(pack.vehicle, "parabrisa-50x30"));
    });
    document.getElementById("vlPrintKey")?.addEventListener("click", () => {
      const pack = modal && modal._vl;
      if (!pack) return;
      printCanvas(pack.canvases.key, KEY.wMm, KEY.hMm);
    });
    document.getElementById("vlDownloadKey")?.addEventListener("click", () => {
      const pack = modal && modal._vl;
      if (!pack) return;
      downloadCanvas(pack.canvases.key, fileName(pack.vehicle, "chave-25x78"));
    });
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
    sizes: { DPI, WINDSHIELD, KEY },
  };
})(typeof window !== "undefined" ? window : globalThis);
