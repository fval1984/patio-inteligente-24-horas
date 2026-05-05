(async () => {
  const r = await fetch("https://amplipatio-web.vercel.app/app.html");
  const t = await r.text();
  console.log("status", r.status, "content-type", r.headers.get("content-type"));
  console.log("FFFD count", (t.match(/\uFFFD/g) || []).length);
  const sec = t.indexOf('section-card patio-subview hidden" data-subview="fechando_ciclo"');
  console.log("fechando section idx", sec);
  console.log(t.slice(sec, sec + 950));
})();
