/**
 * QR Codes permanentes das duas propagandas públicas.
 * O endereço usa o domínio publicado, nunca localhost.
 */
(function (global) {
  const QR_SRC = "/vendor/qrcode.min.js?v=20261005recibo1";
  const PUBLISHED_ORIGIN = "https://amplipatio-web.vercel.app";
  const PNG_SIZE = 1000;
  const VERSIONS = {
    completa: {
      path: "/apresentacao",
      file: "QRCode_AMPLIGUARD_Com_Venda_Direta.png",
      statusId: "propagandaCompletaStatus",
      viewId: "propagandaCompletaVer",
      downloadId: "propagandaCompletaQr",
      copyId: "propagandaCompletaLink",
    },
    patio: {
      path: "/apresentacao-patio",
      file: "QRCode_AMPLIGUARD_Sem_Venda_Direta.png",
      statusId: "propagandaPatioStatus",
      viewId: "propagandaPatioVer",
      downloadId: "propagandaPatioQr",
      copyId: "propagandaPatioLink",
    },
  };
  let listenersReady = false;
  let busy = false;

  function publicOrigin() {
    const host = String(global.location.hostname || "");
    const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
    return local ? PUBLISHED_ORIGIN : global.location.origin;
  }

  function publicUrl(path) {
    const url = new URL(path, publicOrigin()).href;
    if (/localhost|127\.0\.0\.1|\[::1\]/i.test(url)) {
      throw new Error("O QR Code não pode usar endereço local.");
    }
    return url;
  }

  function ensureQrLib() {
    if (global.QRCode && global.QRCode.CorrectLevel) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = QR_SRC;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Não foi possível carregar o gerador de QR Code."));
      document.head.appendChild(s);
    });
  }

  function paintQrModules(ctx, code, x, y, size) {
    const n = code.getModuleCount();
    const cell = size / n;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#000000";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (code.isDark(r, c)) ctx.fillRect(x + c * cell, y + r * cell, cell + 0.5, cell + 0.5);
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
        colorDark: "#000000",
        colorLight: "#ffffff",
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

  function composePng(code) {
    const n = code.getModuleCount();
    const quietModules = 4;
    const cell = PNG_SIZE / (n + quietModules * 2);
    const qr = cell * n;
    const offset = cell * quietModules;
    const canvas = document.createElement("canvas");
    canvas.width = PNG_SIZE;
    canvas.height = PNG_SIZE;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
    paintQrModules(ctx, code, offset, offset, qr);
    return canvas;
  }

  function setStatus(version, message) {
    const el = document.getElementById(version.statusId);
    if (el) el.textContent = message || "";
  }

  function saveCanvas(canvas, filename) {
    canvas.toBlob((blob) => {
      const href = blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (blob) setTimeout(() => URL.revokeObjectURL(href), 2000);
    }, "image/png");
  }

  async function downloadPng(version) {
    if (busy) return;
    busy = true;
    setStatus(version, "Gerando QR Code…");
    try {
      const url = publicUrl(version.path);
      const code = await buildQrModel(url);
      const canvas = composePng(code);
      if (canvas.width !== PNG_SIZE || canvas.height !== PNG_SIZE) {
        throw new Error("Não foi possível montar o PNG do QR Code.");
      }
      saveCanvas(canvas, version.file);
      setStatus(version, "QR Code baixado: " + version.file);
    } catch (err) {
      setStatus(version, err && err.message ? err.message : "Não foi possível gerar o QR Code.");
    } finally {
      busy = false;
    }
  }

  function copyWithSelection(url) {
    const input = document.createElement("textarea");
    input.value = url;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    return ok;
  }

  async function copyLink(version) {
    const url = publicUrl(version.path);
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch (err) {
      copied = false;
    }
    if (!copied) {
      try {
        copied = copyWithSelection(url);
      } catch (err) {
        copied = false;
      }
    }
    setStatus(version, copied ? "Link copiado." : url);
  }

  function visualizar(version) {
    global.open(new URL(version.path, global.location.origin).href, "_blank", "noopener");
  }

  function bind() {
    if (listenersReady) return;
    listenersReady = true;
    Object.keys(VERSIONS).forEach((key) => {
      const version = VERSIONS[key];
      document.getElementById(version.viewId)?.addEventListener("click", () => visualizar(version));
      document.getElementById(version.downloadId)?.addEventListener("click", () => {
        void downloadPng(version);
      });
      document.getElementById(version.copyId)?.addEventListener("click", () => {
        void copyLink(version);
      });
    });
  }

  function mount() {
    bind();
  }

  global.apresentacaoInstitucional = {
    publicUrl: function (path) {
      return publicUrl(path || "/apresentacao");
    },
    mount,
    downloadPng: function () {
      return downloadPng(VERSIONS.completa);
    },
    copyLink: function () {
      return copyLink(VERSIONS.completa);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
