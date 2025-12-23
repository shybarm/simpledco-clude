/*!
  chatbot.js — lightweight, zero-backend, SEO-safe “assistant” widget
  - No external dependencies
  - No impact on existing site logic
  - RTL-first
*/
(function(){
  const qa = [
    { q: "איך קובעים תור?", a: "אפשר לקבוע תור דרך הכפתור ״קביעת תור״ בעמוד או להשאיר פרטים בטופס — ונחזור אליכם בהקדם." , cta: "#appointment"},
    { q: "האם יש ביקורי בית?", a: "כן. קיימת אפשרות לביקורי בית בהתאם לאזור ולזמינות. מומלץ להשאיר פרטים ונחזור לתיאום." , cta: "#appointment"},
    { q: "מה שעות הקבלה?", a: "שעות הקבלה משתנות לפי הלו״ז. כדי לוודא זמינות מדויקת, השאירו פרטים ונחזור אליכם." , cta: "#appointment"},
    { q: "איך אפשר ליצור קשר?", a: "אפשר להתקשר או לשלוח הודעה — וגם להשאיר פרטים בטופס ונחזור אליכם." , cta: "#contact"},
  ];

  const el = (tag, attrs={}, children=[]) => {
    const n=document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{
      if(k==="class") n.className=v;
      else if(k==="html") n.innerHTML=v;
      else n.setAttribute(k,v);
    });
    children.forEach(ch=> n.appendChild(ch));
    return n;
  };

  const mount = () => {
    if(document.getElementById("dw-chat-root")) return;

    const root = el("div", { id:"dw-chat-root", class:"dw-chat" });
    const btn = el("button", { class:"dw-chat__fab", type:"button", "aria-label":"פתח/סגור עוזר" }, []);
    btn.innerHTML = '<span class="dw-chat__fabIcon">💬</span><span class="dw-chat__fabPulse"></span>';

    const panel = el("div", { class:"dw-chat__panel", role:"dialog", "aria-modal":"false", "aria-label":"עוזר מרפאה" });
    panel.innerHTML = `
      <div class="dw-chat__head">
        <div class="dw-chat__title">
          <div class="dw-chat__badge">עוזר מרפאה</div>
          <div class="dw-chat__sub">אפשר לשאול שאלה קצרה או לבחור נושא</div>
        </div>
        <button class="dw-chat__close" type="button" aria-label="סגור">✕</button>
      </div>
      <div class="dw-chat__body">
        <div class="dw-chat__msg dw-chat__msg--bot">
          <div class="dw-chat__bubble">
            שלום! איך אפשר לעזור?
          </div>
        </div>
        <div class="dw-chat__chips"></div>
        <div class="dw-chat__disclaimer">המידע אינו תחליף לייעוץ רפואי.</div>
      </div>
    `;

    document.body.appendChild(root);
    root.appendChild(btn);
    root.appendChild(panel);

    const chips = panel.querySelector(".dw-chat__chips");
    qa.forEach((item)=>{
      const chip = el("button", { class:"dw-chat__chip", type:"button" });
      chip.textContent = item.q;
      chip.addEventListener("click", ()=>{
        addUser(item.q);
        setTimeout(()=> addBot(item.a, item.cta), 250);
      });
      chips.appendChild(chip);
    });

    const close = panel.querySelector(".dw-chat__close");

    const toggle = () => {
      root.classList.toggle("is-open");
      if(root.classList.contains("is-open")){
        try{ localStorage.setItem("dwChatOpened","1"); }catch(e){}
      }
    };

    btn.addEventListener("click", toggle);
    close.addEventListener("click", toggle);

    function addUser(text){
      const body = panel.querySelector(".dw-chat__body");
      const msg = el("div", { class:"dw-chat__msg dw-chat__msg--user" });
      msg.innerHTML = `<div class="dw-chat__bubble">${escapeHtml(text)}</div>`;
      body.insertBefore(msg, body.querySelector(".dw-chat__chips"));
      body.scrollTop = body.scrollHeight;
    }
    function addBot(text, cta){
      const body = panel.querySelector(".dw-chat__body");
      const msg = el("div", { class:"dw-chat__msg dw-chat__msg--bot" });
      let ctaHtml = "";
      if(cta){
        ctaHtml = `<button class="dw-chat__cta" type="button">לפתיחת טופס/יצירת קשר</button>`;
      }
      msg.innerHTML = `<div class="dw-chat__bubble">${escapeHtml(text)}${ctaHtml}</div>`;
      body.insertBefore(msg, body.querySelector(".dw-chat__chips"));
      const ctaBtn = msg.querySelector(".dw-chat__cta");
      if(ctaBtn){
        ctaBtn.addEventListener("click", ()=>{
          const t = document.querySelector(cta);
          if(t) t.scrollIntoView({ behavior:"smooth", block:"start" });
          root.classList.remove("is-open");
        });
      }
      body.scrollTop = body.scrollHeight;
    }
    function escapeHtml(s){
      return (s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    // Optional: reopen if user previously opened
    try{
      if(localStorage.getItem("dwChatOpened")==="1"){
        // keep closed by default (welcoming, not intrusive)
      }
    }catch(e){}
  };

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
