// cleanup.js — removes "פופולרי" labels safely (front-only)
document.addEventListener("DOMContentLoaded", () => {
  // 1) Remove exact text nodes
  document.querySelectorAll("body *").forEach((el) => {
    if (el.children.length === 0 && el.textContent.trim() === "פופולרי") {
      el.remove();
    }
  });

  // 2) Remove common badge containers that contain the word
  document.querySelectorAll("body *").forEach((el) => {
    const t = el.textContent ? el.textContent.trim() : "";
    if (t === "פופולרי" && el.closest) {
      const badge = el.closest(".badge, .pill, .tag, .ribbon, .chip, .label");
      if (badge) badge.remove();
    }
  });
});
