/**
 * Paginação A4 da Ficha Tipo 2.
 * Uma página quando a escala continua legível. O bloco do Pix não é dividido.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.fichaTipo2Print = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function fichaTipo2PrintFactory() {
  "use strict";

  const A4 = { widthMm: 210, heightMm: 297, marginMm: 8, minScale: 0.72 };

  function mmToPx(mm, dpi) {
    return (Number(mm) * (dpi || 96)) / 25.4;
  }

  function printWidthPx(dpi) {
    return Math.round(mmToPx(A4.widthMm - A4.marginMm * 2, dpi));
  }

  function pageContentPx(dpi) {
    return mmToPx(A4.heightMm - A4.marginMm * 2, dpi);
  }

  function planFichaPages(contentPx, pagePx, pixTop, pixHeight, minScale) {
    const content = Math.max(1, Math.round(Number(contentPx) || 1));
    const page = Math.max(1, Math.round(Number(pagePx) || 1));
    const floor = typeof minScale === "number" ? minScale : A4.minScale;
    const top = Math.max(0, Math.round(Number(pixTop) || 0));
    const ph = Math.max(0, Math.round(Number(pixHeight) || 0));
    const pixBottom = top + ph;

    if (content <= page) {
      return { mode: "single", scale: 1, slices: [{ y: 0, h: content }] };
    }
    const fit = page / content;
    if (fit >= floor) {
      return { mode: "single", scale: fit, slices: [{ y: 0, h: content }] };
    }

    let capacity = page;
    let scale = 1;
    if (ph > page) {
      scale = page / ph;
      capacity = ph;
    }

    const slices = [];
    let y = 0;
    let guard = 0;
    while (y < content && guard < 80) {
      guard += 1;
      let end = Math.min(y + capacity, content);
      const cutsPix = ph > 0 && top < end && pixBottom > end && top < pixBottom;
      if (cutsPix && top > y) end = top;
      if (end <= y) end = Math.min(content, y + capacity);
      slices.push({ y: y, h: end - y });
      y = end;
    }
    if (!slices.length) slices.push({ y: 0, h: content });
    return { mode: slices.length > 1 ? "multi" : "single", scale: scale, slices: slices };
  }

  return {
    A4: A4,
    mmToPx: mmToPx,
    printWidthPx: printWidthPx,
    pageContentPx: pageContentPx,
    planFichaPages: planFichaPages,
  };
});
