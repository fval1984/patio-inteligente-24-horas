/**
 * Corrige mojibake restante em public/app.html após correção por pares UTF-8.
 * Uso (na raiz do repo): node scripts/fix-app-mojibake.js
 */
const fs = require("fs");
const path = require("path");

const APP = path.join(__dirname, "..", "public", "app.html");
let s = fs.readFileSync(APP, "utf8");

/** Sequências literais erradas → carácter Unicode correto */
const EXPLICIT = [
  ["\u00c3\u0161", "Ú"],
  ["\u00c3\u2030", "É"], // Ã‰
  ["\u00c3\u2014", "\u00d7"], // Ã— (antes era × UTF-8; acabou ligado ao em-dash)
  ["\u00e2\u2020\u2019", "\u2192"],
  ["\u00e2\u20ac\u201d", "\u2014"], // â€”
  ["\u00e2\u20ac\xa2", "\u2022"], // â€¢
  ["\u00e2\u20ac\xa6", "\u2026"], // â€¦
  ["\u00e2\u20ac\u2018", "-"], // Wi‑Fi etc.
  ["\u00e2\u20ac\u0153", "\u201c"], // â€œ
  ["\u00e2\u20ac\u009d", "\u201d"], // â€ (UTF-8 9D truncado como carácter)
  ["RECIBO DE QUITAÃ‡ÃƒO DE ESTADIAS", "RECIBO DE QUITAÇÃO DE ESTADIAS"],
];

for (const [bad, good] of EXPLICIT) {
  const n = splitCount(s, bad);
  if (n) console.error(bad.codePointAt(0).toString(16), "...", "×", n);
  s = s.split(bad).join(good);
}

function splitCount(str, sub) {
  if (!sub) return 0;
  return str.split(sub).length - 1;
}

fs.writeFileSync(APP, s, "utf8");
console.error("Written", APP);
