/**
 * Período DD/MM/AAAA com dia inicial e final inclusos.
 * node public/periodo-filtro.test.js
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.periodoFiltro = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function mask(value) {
    const d = String(value || "").replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0, 2) + "/" + d.slice(2);
    return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function validYmd(y, m, d) {
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function parse(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    let y;
    let m;
    let d;
    if (iso) {
      y = Number(iso[1]);
      m = Number(iso[2]);
      d = Number(iso[3]);
    } else if (br) {
      d = Number(br[1]);
      m = Number(br[2]);
      y = Number(br[3]);
    } else {
      return null;
    }
    if (!validYmd(y, m, d)) return null;
    return y + "-" + pad(m) + "-" + pad(d);
  }

  function format(ymd) {
    const parsed = parse(ymd);
    if (!parsed) return "";
    const [y, m, d] = parsed.split("-");
    return d + "/" + m + "/" + y;
  }

  function calendarDay(value) {
    const s = String(value || "").trim();
    if (!s) return "";
    const dateOnly = s.match(/^(\d{4}-\d{2}-\d{2})(?!T)/);
    if (dateOnly) return dateOnly[1];
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
  }

  function inRange(value, de, ate) {
    if (!de && !ate) return true;
    const dia = calendarDay(value);
    if (!dia) return false;
    if (de && dia < de) return false;
    if (ate && dia > ate) return false;
    return true;
  }

  function read(deRaw, ateRaw) {
    const de = parse(deRaw);
    const ate = parse(ateRaw);
    if (de === null || ate === null) {
      return { ok: false, erro: "Informe as datas no formato DD/MM/AAAA." };
    }
    if (de && ate && de > ate) {
      return { ok: false, erro: "A data inicial não pode ser posterior à data final." };
    }
    return { ok: true, de: de, ate: ate };
  }

  return {
    mask: mask,
    parse: parse,
    format: format,
    calendarDay: calendarDay,
    inRange: inRange,
    read: read,
  };
});
