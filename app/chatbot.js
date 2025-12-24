/* chatbot.js — front-end assistant (no backend)
   Goal: smoother UX + higher conversion (SEO-friendly, non-intrusive).
   Safe: does not touch appointment submit logic or Supabase.
*/
(function(){
  const qs = (s, r=document) => r.querySelector(s);

  // ---------- UI: launcher + panel ----------
  const launcher = document.createElement('button');
  launcher.className = 'chatbot-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label','פתיחת עוזר דיגיטלי');
  launcher.innerHTML = '💬';

  const panel = document.createElement('div');
  panel.className = 'chatbot-panel';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','עוזר דיגיטלי');
  panel.innerHTML = `
    <div class="chatbot-head">
      <div class="chatbot-title">עוזר דיגיטלי</div>
      <button class="chatbot-close" type="button" aria-label="סגור">✕</button>
    </div>
    <div class="chatbot-disclaimer">
      העוזר הדיגיטלי אינו תחליף לייעוץ רפואי. במקרה חירום – פנו מיידית למד״א/חדר מיון.
    </div>
    <div class="chatbot-quick" aria-label="קיצורי דרך"></div>
    <div class="chatbot-body" role="log" aria-live="polite"></div>
    <div class="chatbot-foot">
      <input class="chatbot-input" type="text" inputmode="text" autocomplete="off" placeholder="מה תרצו לדעת?" />
      <button class="chatbot-send" type="button">שלח</button>
    </div>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const closeBtn = qs('.chatbot-close', panel);
  const body = qs('.chatbot-body', panel);
  const input = qs('.chatbot-input', panel);
  const sendBtn = qs('.chatbot-send', panel);
  const quick = qs('.chatbot-quick', panel);

  // ---------- helpers ----------
  const normalize = (s) => (s||'')
    .toString()
    .trim()
    .toLowerCase();

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

  function addMsg(text, who='bot'){
    const d = document.createElement('div');
    d.className = 'chatbot-msg' + (who==='me' ? ' me' : '');
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }

  function addChips(items){
    quick.innerHTML = '';
    items.forEach(({label, payload})=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chatbot-chip';
      b.textContent = label;
      b.addEventListener('click', ()=>{
        open();
        addMsg(label, 'me');
        setTimeout(()=>reply(payload || label), 120);
      });
      quick.appendChild(b);
    });
  }

  // ---------- “template-like” flow ----------
  const chipsHome = [
    {label:'קביעת תור', payload:'קביעת תור'},
    {label:'שעות פעילות', payload:'שעות פעילות'},
    {label:'כתובת והגעה', payload:'כתובת'},
    {label:'שירותים', payload:'שירותים'},
    {label:'וואטסאפ/טלפון', payload:'טלפון'}
  ];

  const urgentSignals = [
    'קוצר נשימה','כאב בחזה','התעלפ','עילפון','חנק','כיחל','דימום חזק','פרכוס','חוסר הכרה','אלרגיה קשה','אנפילקסיס'
  ];

  function reply(userText){
    const t = normalize(userText);

    if(!t){
      addMsg('אפשר לבחור אפשרות למעלה, או לכתוב חופשי מה הבעיה / מה אתם צריכים.');
      return;
    }

    // Urgent triage (gentle, clear)
    if(urgentSignals.some(x => t.includes(normalize(x)))){
      addMsg('זה נשמע דחוף. במקרה של סכנה מיידית – פנו עכשיו למד״א 101 או לחדר מיון.');
      addMsg('אם זה לא מצב חירום – כתבו גיל ותיאור קצר של הסימפטומים ואכוון אתכם.');
      return;
    }

    if(t.includes('תור') || t.includes('קביעת') || t.includes('appointment')){
      addMsg('מעולה — אני מגלגלת לטופס קביעת התור.');
      if(!scrollToAny(['#appointment', '#book', '#contact', 'form', '.appointment-form'])){
        addMsg('לא מצאתי טופס בעמוד הזה. אפשר להשאיר פרטים בטופס יצירת קשר.');
        scrollToAny(['#contact', 'footer']);
      }
      return;
    }

    if(t.includes('שעות') || t.includes('פתוח') || t.includes('פעילות')){
      addMsg('שעות הפעילות מופיעות באזור יצירת קשר. מגלגלת לשם.');
      scrollToAny(['#hours', '#contact', 'footer']);
      return;
    }

    if(t.includes('כתובת') || t.includes('מיקום') || t.includes('הגעה') || t.includes('חניה')){
      addMsg('הנה אזור הכתובת וההגעה. מגלגלת ליצירת קשר.');
      scrollToAny(['#contact', 'footer']);
      return;
    }

    if(t.includes('טלפון') || t.includes('וואטסאפ') || t.includes('whatsapp') || t.includes('מייל') || t.includes('email')){
      addMsg('אפשר ליצור קשר כאן. מגלגלת לאזור יצירת קשר.');
      scrollToAny(['#contact', 'footer']);
      return;
    }

    if(t.includes('שירות') || t.includes('טיפול') || t.includes('אלרג') || t.includes('אסתמה') || t.includes('בדיקה')){
      addMsg('יש בעמוד פירוט שירותים. אם תכתבו מה הסימפטום/הצורך — אכוון לשירות המתאים.');
      scrollToAny(['#services', 'section']);
      return;
    }

    // fallback: guide to structured info for better conversion
    addMsg('כדי לעזור מהר: כתבו “קביעת תור”, “שעות פעילות”, “כתובת”, או תיאור קצר של הבעיה (כולל גיל).');
  }

  function open(){
    panel.classList.add('open');
    input.focus();
  }
  function close(){
    panel.classList.remove('open');
  }

  launcher.addEventListener('click', () => {
    panel.classList.contains('open') ? close() : open();
  });
  closeBtn.addEventListener('click', close);

  function send(){
    const v = input.value;
    input.value = '';
    addMsg(v, 'me');
    setTimeout(()=>reply(v), 140);
  }
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') send(); });

  // init
  addChips(chipsHome);
  addMsg('היי! אני העוזר הדיגיטלי 😊 איך אפשר לעזור?');
})();