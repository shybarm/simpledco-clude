/* chatbot.js — front-end UX upgrade only (no backend changes) */
(function () {
  const BOT_VERSION = "v4";

  const style = document.createElement("style");
  style.textContent = `
    .bot-fab{position:fixed;left:18px;bottom:18px;z-index:9999;border-radius:999px;border:1px solid rgba(15,23,42,.12);
      box-shadow:0 12px 30px rgba(15,23,42,.14);padding:12px 14px;background:#fff;cursor:pointer;display:flex;gap:10px;align-items:center}
    .bot-fab .dot{width:10px;height:10px;border-radius:50%;background:#22c55e}
    .bot-fab strong{font-weight:700}
    .bot-panel{position:fixed;left:18px;bottom:76px;z-index:9999;width:min(360px, calc(100vw - 36px));
      border-radius:18px;border:1px solid rgba(15,23,42,.12);background:#fff;box-shadow:0 18px 50px rgba(15,23,42,.18);overflow:hidden;display:none}
    .bot-head{padding:14px 14px 10px;border-bottom:1px solid rgba(15,23,42,.08);display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .bot-head h4{margin:0;font-size:15px}
    .bot-head p{margin:6px 0 0;font-size:12px;opacity:.75;line-height:1.35}
    .bot-close{border:none;background:transparent;font-size:18px;cursor:pointer;line-height:1}
    .bot-body{padding:12px;max-height:360px;overflow:auto}
    .bot-msg{margin:10px 0;display:flex}
    .bot-msg.me{justify-content:flex-end}
    .bot-bubble{max-width:85%;padding:10px 12px;border-radius:16px;border:1px solid rgba(15,23,42,.10);line-height:1.35}
    .bot-msg.bot .bot-bubble{background:rgba(15,23,42,.03)}
    .bot-msg.me .bot-bubble{background:rgba(59,130,246,.10);border-color:rgba(59,130,246,.20)}
    .bot-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    .bot-chip{border:1px solid rgba(15,23,42,.14);background:#fff;border-radius:999px;padding:8px 10px;cursor:pointer;font-size:13px}
    .bot-chip:hover{transform:translateY(-1px)}
    .bot-foot{padding:10px 12px;border-top:1px solid rgba(15,23,42,.08);display:flex;gap:8px}
    .bot-foot input{flex:1;border-radius:14px;border:1px solid rgba(15,23,42,.16);padding:10px 12px}
    .bot-foot button{border-radius:999px;border:1px solid rgba(15,23,42,.14);background:#111827;color:#fff;padding:10px 12px;cursor:pointer}
  `;
  document.head.appendChild(style);

  const fab = document.createElement("button");
  fab.className = "bot-fab";
  fab.type = "button";
  fab.innerHTML = `<span class="dot"></span><strong>צ׳אט מהיר</strong><span style="opacity:.7;font-size:12px">(${BOT_VERSION})</span>`;
  document.body.appendChild(fab);

  const panel = document.createElement("div");
  panel.className = "bot-panel";
  panel.innerHTML = `
    <div class="bot-head">
      <div>
        <h4>עוזר המרפאה</h4>
        <p>מידע כללי בלבד. במקרה חירום רפואי — פנו מיד למד״א 101 או לחדר מיון.</p>
      </div>
      <button class="bot-close" aria-label="סגירה">×</button>
    </div>
    <div class="bot-body" id="botBody"></div>
    <div class="bot-foot">
      <input id="botInput" placeholder="כתוב שאלה קצרה…" />
      <button id="botSend" type="button">שלח</button>
    </div>
  `;
  document.body.appendChild(panel);

  const body = panel.querySelector("#botBody");
  const input = panel.querySelector("#botInput");
  const sendBtn = panel.querySelector("#botSend");

  function addMsg(text, who = "bot") {
    const wrap = document.createElement("div");
    wrap.className = `bot-msg ${who}`;
    const bubble = document.createElement("div");
    bubble.className = "bot-bubble";
    bubble.textContent = text;
    wrap.appendChild(bubble);
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  function addChips(chips) {
    const row = document.createElement("div");
    row.className = "bot-chips";
    chips.forEach(({ label, onClick }) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bot-chip";
      b.textContent = label;
      b.addEventListener("click", onClick);
      row.appendChild(b);
    });
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  function openPanel() {
    panel.style.display = "block";
    if (!panel.dataset.init) {
      panel.dataset.init = "1";
      addMsg("היי 🙂 איך אפשר לעזור?");
      addChips([
        { label: "קביעת תור", onClick: () => scrollToId("appointment") },
        { label: "שעות פעילות", onClick: () => addMsg("א׳–ה׳: 9:00–18:00 | ו׳: 9:00–13:00 | שבת: סגור") },
        { label: "כתובת", onClick: () => addMsg("רוטשילד 123, תל אביב") },
        { label: "שירותים", onClick: () => addMsg("ייעוץ כללי, ביקורי בית, ניהול מחלות כרוניות, רפואה מונעת, ילדים ועוד.") },
        { label: "WhatsApp", onClick: () => window.open("https://wa.me/972501234567", "_blank") }
      ]);
    }
    input.focus();
  }

  function closePanel() {
    panel.style.display = "none";
  }

  function scrollToId(id) {
    closePanel();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else addMsg("לא מצאתי את אזור קביעת התור בעמוד. תגיד לי אם תרצה שאפנה אותך ליצירת קשר.");
  }

  function isUrgent(t) {
    const s = (t || "").toLowerCase();
    return ["כאב בחזה","קוצר נשימה","עילפון","דימום","חוסר הכרה","שבץ","התקף"].some(k => s.includes(k));
  }

  function handle(text) {
    const t = (text || "").trim();
    if (!t) return;
    addMsg(t, "me");

    if (isUrgent(t)) {
      addMsg("זה נשמע דחוף. במקרה של סכנת חיים — פנו מיד למד״א 101 או לחדר מיון.");
      return;
    }

    const tl = t.toLowerCase();
    if (tl.includes("תור") || tl.includes("לקבוע")) {
      addMsg("מעולה — אני מעביר אותך לקביעת תור בעמוד.");
      scrollToId("appointment");
      return;
    }
    if (tl.includes("שעות") || tl.includes("פתוח")) {
      addMsg("א׳–ה׳: 9:00–18:00 | ו׳: 9:00–13:00 | שבת: סגור");
      return;
    }
    if (tl.includes("כתובת") || tl.includes("איפה")) {
      addMsg("רוטשילד 123, תל אביב. אפשר גם ללחוץ על Waze/Google Maps באזור 'צור קשר'.");
      return;
    }
    if (tl.includes("ווטסאפ") || tl.includes("whatsapp")) {
      addMsg("פותח WhatsApp…");
      window.open("https://wa.me/972501234567", "_blank");
      return;
    }

    addMsg("אני יכול לעזור עם קביעת תור, שעות, כתובת ושירותים. מה תרצה?");
  }

  fab.addEventListener("click", () => (panel.style.display === "block" ? closePanel() : openPanel()));
  panel.querySelector(".bot-close").addEventListener("click", closePanel);
  sendBtn.addEventListener("click", () => handle(input.value) || (input.value = ""));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handle(input.value);
      input.value = "";
    }
  });
})();
