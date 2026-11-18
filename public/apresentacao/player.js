/**
 * Apresentação pública AMPLIGUARD.
 * A música tenta começar ao abrir, segue entre as imagens e fica em 80%.
 * Se o navegador bloquear o som automático, ela entra na primeira interação.
 */
(function () {
  const slides = Array.isArray(window.APRESENTACAO_SLIDES) ? window.APRESENTACAO_SLIDES : [];
  const VOLUME = 0.8;
  const FALLBACK_WHATSAPP = "5581999918484";
  const WHATSAPP_TEXT =
    "Olá! Conheci a AMPLIGUARD através da apresentação institucional e gostaria de obter mais informações sobre os serviços.";
  if (!slides.length) return;

  const audio = document.createElement("audio");
  audio.loop = true;
  audio.autoplay = true;
  audio.preload = "auto";
  audio.volume = VOLUME;
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");
  audio.src = "/apresentacao/alanajordan-bossa-nova-instrumental-01-359887.mp3";
  audio.hidden = true;
  document.body.appendChild(audio);

  const img = document.getElementById("slide");
  const contato = document.getElementById("contato");
  let idx = 0;
  let started = false;
  let whatsappDigits = FALLBACK_WHATSAPP;

  function whatsappHref(digits) {
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(WHATSAPP_TEXT);
  }

  function normalizeWhatsapp(raw) {
    let digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return "";
  }

  function applyContato() {
    const last = idx === slides.length - 1;
    document.body.classList.toggle("contato", last && !!whatsappDigits);
    if (!contato) return;
    if (last && whatsappDigits) {
      contato.href = whatsappHref(whatsappDigits);
      contato.hidden = false;
    } else {
      contato.hidden = true;
    }
  }

  function render() {
    img.src = slides[idx];
    img.alt = "Página " + (idx + 1) + " da apresentação AMPLIGUARD";
    document.getElementById("count").textContent = (idx + 1) + " / " + slides.length;
    document.getElementById("next").textContent = idx === slides.length - 1 ? "Recomeçar ↻" : "Avançar ›";
    applyContato();
  }

  function startMusic() {
    audio.volume = VOLUME;
    if (started && !audio.paused) return;
    const pending = audio.play();
    if (pending && typeof pending.then === "function") {
      pending.then(function () { started = true; }).catch(function () { started = false; });
    } else {
      started = true;
    }
  }

  audio.addEventListener("canplay", startMusic);
  startMusic();

  function go(delta) {
    startMusic();
    idx = (idx + delta + slides.length) % slides.length;
    render();
  }

  img.addEventListener("click", function () { go(1); });
  img.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      go(1);
    }
  });
  document.getElementById("next").addEventListener("click", function () { go(1); });
  document.getElementById("prev").addEventListener("click", function () { go(-1); });
  document.addEventListener("pointerdown", startMusic);
  document.addEventListener("keydown", function (event) {
    if (event.key === "ArrowRight") go(1);
    else if (event.key === "ArrowLeft") go(-1);
    else startMusic();
  });

  fetch("/api/apresentacao/contato", { cache: "no-store" })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      const digits = normalizeWhatsapp(data && data.whatsapp);
      if (digits) whatsappDigits = digits;
      applyContato();
    })
    .catch(function () { applyContato(); });

  render();
})();
