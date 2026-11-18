const fs = require("fs");
const path = require("path");

const src = "C:/Users/FERNANDO/OneDrive/Desktop/AMPLIGUARD _ Apresentação Institucional.html";
const s = fs.readFileSync(src, "utf8");
const scriptAt = s.indexOf("<script>");
const head = s.slice(0, scriptAt).replace(/data:[^"']+/g, "DATA");
const markupOut = path.join(__dirname, "_apresentacao-markup.txt");
fs.writeFileSync(markupOut, head, "utf8");
console.log("markup", head.length);

const script = s.slice(scriptAt);
const m = script.match(/const slides=\[(.*?)\];/);
if (!m) {
  console.error("slides array not found");
  process.exit(1);
}
const parts = [];
const re = /"(data:[^"]+)"/g;
let match;
while ((match = re.exec(m[1]))) parts.push(match[1]);
console.log("slides", parts.length);
const dir = path.join(__dirname, "..", "public", "apresentacao", "slides");
fs.mkdirSync(dir, { recursive: true });
parts.forEach((uri, i) => {
  const meta = uri.slice(0, uri.indexOf(","));
  const b64 = uri.slice(uri.indexOf(",") + 1);
  const ext = /png/.test(meta) ? "png" : /jpeg|jpg/.test(meta) ? "jpg" : "bin";
  const name = String(i + 1).padStart(2, "0") + "." + ext;
  const buf = Buffer.from(b64, "base64");
  fs.writeFileSync(path.join(dir, name), buf);
  console.log(name, meta, buf.length);
});
