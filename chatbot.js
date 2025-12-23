/* chatbot.js — lightweight client-side bot (no backend required)
   Safe: does not alter your appointment flow. Provides quick answers + CTAs.
*/
(function(){
  const qs = (s, r=document) => r.querySelector(s);

  // Create launcher + panel
  const launcher = document.createElement('button');
  launcher.className = 'chatbot-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label','צ׳אט עוזר');
  launcher.textContent = '💬';

  const panel = document.createElement('div');
  panel.className = 'chatbot-panel';
  panel.innerHTML = `
    <div class="chatbot-head">
      <div class="chatbot-title">עוזר דיגיטלי</div>
      <button class="chatbot-close" type="button" aria-label="סגור">✕</button>
    </div>
    <div class="chatbot-body" role="log" aria-live="polite"></div>
    <div class="chatbot-foot">
      <input class="chatbot-input" type="text" placeholder="שאלו אותי..." />
      <button class="chatbot-send" type="button">שלח</button>
    </div>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const closeBtn = qs('.chatbot-close', panel);
  const body = qs('.chatbot-body', panel);
  const input = qs('.chatbot-input', panel);
  const sendBtn = qs('.chatbot-send', panel);

  function addMsg(text, who='bot'){
    const d = document.createElement('div');
    d.className = 'chatbot-msg' + (who==='me' ? ' me' : '');
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }

  // Simple intent routing (Hebrew-friendly)
  function reply(userText){
    const t = (userText||'').toLowerCase().trim();

    // CTAs: try to scroll to existing anchors / sections without assumptions
    const scrollToAny = (selectors) => {
      for(const s of selectors){
        const el = document.querySelector(s);
        if(el){
          el.scrollIntoView({behavior:'smooth', block:'start'});
          return true;
        }
      }
      return false;
    };

    if(!t){
      addMsg('אפשר לשאול על קביעת תור, שעות פעילות, שירותים או דרכי קשר.');
      return;
    }

    if(t.includes('תור') || t.includes('קביעת') || t.includes('appointment')){
      addMsg('מעולה — אפשר לקבוע תור דרך הטופס באתר. אני מעבירה אותך עכשיו.');
      scrollToAny(['#appointment', '#book', '#contact', 'form', '.appointment-form']);
      return;
    }

    if(t.includes('שעות') || t.includes('פתוח') || t.includes('פעילות')){
      addMsg('שעות הפעילות מופיעות בעמוד. אם תרצו — כתבו לי את היום המבוקש ואכוון אתכם.');
      scrollToAny(['#hours', '#contact', 'footer']);
      return;
    }

    if(t.includes('כתובת') || t.includes('מיקום') || t.includes('הגעה')){
      addMsg('כתובת המרפאה מופיעה בעמוד יצירת קשר. אני מגלגלת לשם.');
      scrollToAny(['#contact', 'footer']);
      return;
    }

    if(t.includes('טלפון') || t.includes('וואטסאפ') || t.includes('whatsapp') || t.includes('מייל') || t.includes('email')){
      addMsg('אפשר ליצור קשר דרך כפתור הטלפון/וואטסאפ בעמוד. אני מגלגלת ליצירת קשר.');
      scrollToAny(['#contact', 'footer']);
      return;
    }

    if(t.includes('שירות') || t.includes('טיפול') || t.includes('אלרג') || t.includes('אסתמה')){
      addMsg('יש מגוון שירותים בעמוד “שירותים”. אם תכתבו מה הסימפטום/הצורך — אכוון לשירות המתאים.');
      scrollToAny(['#services', 'section']);
      return;
    }

    addMsg('קיבלתי. כדי לעזור מהר: כתבו “קביעת תור”, “שעות פעילות”, “כתובת”, או “שירותים”.');
  }

  function open(){
    panel.classList.add('open');
    input.focus();
  }
  function close(){
    panel.classList.remove('open');
  }

  launcher.addEventListener('click', () => {
    if(panel.classList.contains('open')) close(); else open();
  });
  closeBtn.addEventListener('click', close);

  function send(){
    const v = input.value;
    input.value = '';
    addMsg(v, 'me');
    setTimeout(()=>reply(v), 150);
  }
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') send(); });

  // Welcome message
  addMsg('היי! אני העוזר הדיגיטלי 😊 איך אפשר לעזור?');
})();
