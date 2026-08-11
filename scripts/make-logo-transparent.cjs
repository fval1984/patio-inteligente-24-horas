/**
 * Remove o fundo escuro da logo do cabeçalho (chroma key por amostragem dos cantos).
 * Uso: node scripts/make-logo-transparent.cjs
 * Requer: npm install sharp --no-save
 */
const fs = require("fs");
const path = require("path");

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.error("Instale sharp: npm install sharp --no-save");
    process.exit(1);
  }

  const input = path.join(__dirname, "..", "public", "assets", "ampliguard-header.png");
  if (!fs.existsSync(input)) {
    console.error("Arquivo não encontrado:", input);
    process.exit(1);
  }

  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const samplePoints = [
    [8, 8],
    [width - 9, 8],
    [8, height - 9],
    [width - 9, height - 9],
    [width >> 1, 8],
  ];

  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  for (const [x, y] of samplePoints) {
    const i = (y * width + x) * channels;
    avgR += data[i];
    avgG += data[i + 1];
    avgB += data[i + 2];
  }
  avgR /= samplePoints.length;
  avgG /= samplePoints.length;
  avgB /= samplePoints.length;

  const threshold = 52;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const dr = r - avgR;
      const dg = g - avgG;
      const db = b - avgB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      const isDarkBg = r < 100 && g < 120 && b < 110 && g - r < 60;
      if (dist < threshold || (isDarkBg && dist < threshold + 24)) {
        data[i + 3] = 0;
      }
    }
  }

  const tmp = input + ".tmp.png";
  await sharp(data, { raw: { width, height, channels } }).png({ compressionLevel: 9 }).toFile(tmp);
  fs.renameSync(tmp, input);
  console.log("OK — fundo removido:", input, `(${width}x${height})`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
