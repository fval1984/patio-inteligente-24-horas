/**
 * Abre a caderneta original dentro de Parceiros.
 * A tela, os cálculos e as ações continuam os de financeRenderReceber.
 */
(function parceiroCadernetaModule(global) {
  "use strict";

  function render() {
    const panel = document.querySelector('#parceiroCadernetaRoot [data-finance-subview="receber"]');
    if (panel) {
      panel.classList.remove("hidden");
      panel.hidden = false;
    }
    if (typeof global.financeRenderReceber === "function") global.financeRenderReceber();
  }

  global.parceiroCaderneta = { render };
})(typeof window !== "undefined" ? window : globalThis);
