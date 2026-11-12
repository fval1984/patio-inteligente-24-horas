/**
 * Download PNG: placa vertical (esquerda) + QR do registro (direita).
 * O arquivo baixado É esta composição — não o QR isolado.
 */
(function (global) {
  const BLACK = "#000000";
  const WHITE = "#ffffff";
  const QR_SRC = "/vendor/qrcode.min.js?v=20261005recibo1";
  const OUT_W = 2046;
  const OUT_H = 1368;

  function publicHistoryUrl(token, ficha) {
    const origin = typeof location !== "undefined" ? location.origin : "";
    const base = `${origin}/v/${String(token || "").trim()}`;
    const tipo = Number(ficha) === 2 ? 2 : 1;
    return tipo === 2 ? `${base}?ficha=2` : base;
  }

  function db() {
    return global.supabaseClient || (typeof supabase !== "undefined" ? supabase : null);
  }

  function plateLabel(placa) {
    return String(placa || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  async function loadSameRecord(vehicle) {
    if (!vehicle || !vehicle.id) {
      throw new Error("Registro do veículo não identificado.");
    }
    const id = String(vehicle.id);
    const client = db();
    if (client) {
      const { data, error } = await client
        .from("vehicles")
        .select("id,placa,public_token")
        .eq("id", id)
        .maybeSingle();
      if (!error && data && String(data.id) === id) {
        return {
          id: data.id,
          placa: data.placa,
          public_token: data.public_token || vehicle.public_token || "",
        };
      }
    }
    return {
      id: vehicle.id,
      placa: vehicle.placa,
      public_token: vehicle.public_token || "",
    };
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

  function paintQrModules(ctx, code, x, y, size) {
    const n = code.getModuleCount();
    const cell = size / n;
    ctx.fillStyle = WHITE;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = BLACK;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (code.isDark(r, c)) {
          ctx.fillRect(x + c * cell, y + r * cell, cell + 0.5, cell + 0.5);
        }
      }
    }
  }

  async function buildQrModel(text) {
    await ensureQrLib();
    const holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:fixed;left:-9999px;top:0;width:8px;height:8px;overflow:hidden;";
    document.body.appendChild(holder);
    try {
      const inst = new global.QRCode(holder, {
        text,
        width: 8,
        height: 8,
        colorDark: BLACK,
        colorLight: WHITE,
        correctLevel: global.QRCode.CorrectLevel.M,
      });
      const code = inst._oQRCode;
      if (!code || typeof code.getModuleCount !== "function") {
        throw new Error("QR Code indisponível.");
      }
      return code;
    } finally {
      holder.remove();
    }
  }

  function composePlateAndQr(code, placa, ficha) {
    const tipo = Number(ficha) === 2 ? 2 : 1;
    const label = plateLabel(placa);
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, OUT_W, OUT_H);

    const padT = Math.round(OUT_H * 0.081);
    const padB = Math.round(OUT_H * 0.064);
    const padL = Math.round(OUT_W * 0.084);
    const qrSize = OUT_H - padT - padB;
    const plateCol = Math.round(OUT_W * 0.132);
    const gap = Math.round(OUT_W * 0.078);
    const qrX = padL + plateCol + gap;
    const qrY = padT;

    ctx.save();
    ctx.translate(padL + plateCol / 2, padT + qrSize / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = BLACK;
    let fontPx = Math.round(qrSize * 0.22);
    ctx.font = `bold ${fontPx}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    while (ctx.measureText(label).width > qrSize * 0.98 && fontPx > 24) {
      fontPx -= 2;
      ctx.font = `bold ${fontPx}px Arial, Helvetica, sans-serif`;
    }
    ctx.fillText(label, 0, 0);
    ctx.restore();

    paintQrModules(ctx, code, qrX, qrY, qrSize);
    ctx.fillStyle = BLACK;
    ctx.font = `bold ${Math.round(padB * 0.38)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`QR TIPO ${tipo}`, qrX + qrSize / 2, qrY + qrSize + padB * 0.52);
    return canvas;
  }

  function downloadCanvas(canvas, filename) {
    canvas.toBlob(function (blob) {
      if (!blob) {
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 2000);
    }, "image/png");
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

  async function buildPngCanvas(vehicle, ficha) {
    const record = await loadSameRecord(vehicle);
    const placa = plateLabel(record.placa);
    if (!placa) {
      throw new Error("Este registro não tem placa cadastrada.");
    }
    const token = await ensureToken(record);
    if (String(record.id) !== String(vehicle.id)) {
      throw new Error("A placa e o QR Code não correspondem ao mesmo registro.");
    }
    const code = await buildQrModel(publicHistoryUrl(token, ficha));
    return { canvas: composePlateAndQr(code, placa, ficha), placa, id: record.id };
  }

  async function downloadForVehicle(vehicle, ficha) {
    const tipo = Number(ficha) === 2 ? 2 : 1;
    const one = await buildPngCanvas(vehicle, tipo);
    if (!one.canvas || one.canvas.width <= one.canvas.height) {
      throw new Error("Falha ao montar a imagem da placa com o QR Code.");
    }
    downloadCanvas(one.canvas, `ampliguard-qr-${one.placa}-tipo${tipo}.png`);
    return one.canvas;
  }

  global.vehicleQr = {
    publicHistoryUrl,
    ensureToken,
    buildPngCanvas,
    downloadForVehicle,
  };
  global.vehicleLabels = {
    openForVehicle: downloadForVehicle,
    downloadForVehicle,
  };
})(typeof window !== "undefined" ? window : globalThis);
