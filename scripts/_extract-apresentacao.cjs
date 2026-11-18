const fs = require("fs");
const path = require("path");

const src = "C:/Users/FERNANDO/OneDrive/Desktop/AMPLIGUARD _ Apresentação Institucional.html";
const s = fs.readFileSync(src, "utf8");
const scriptStart = s.indexOf("<script>");
const script = s.slice(scriptStart);
const stripped = script.replace(/data:[^"']+/g, "DATA");
const out = path.join(__dirname, "_apresentacao-script.txt");
fs.writeFileSync(out, stripped, "utf8");
console.log("script chars", script.length, "stripped", stripped.length);
console.log("written", out);
