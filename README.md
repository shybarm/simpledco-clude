# Simple Doctor Website

קל, פשוט, עובד מיד!

## מה זה?

אתר פשוט לרופא עם:
- ✅ עמוד אחד - הכל בו
- ✅ HTML, CSS, JS רגיל - ללא build
- ✅ עובד באופן מיידי
- ✅ קל לעריכה
- ✅ מוכן ל-Vercel

## איך להשתמש?

### 1. ערוך את הקבצים

**index.html** - שנה:
- שם הרופא (ד״ר גל גולדהבר)
- טלפון (03-123-4567)
- כתובת (רחוב רוטשילד 123)
- אימייל (info@goldhabermd.co.il)
- שירותים ומחירים
- שעות פעילות

**style.css** - שנה צבעים:
```css
:root {
    --primary: #0066CC;  /* צבע עיקרי */
    --secondary: #00A86B; /* צבע משני */
}
```

### 2. העלה ל-GitHub

```bash
git init
git add .
git commit -m "Doctor website"
git remote add origin YOUR_REPO_URL
git push -u origin main
```

### 3. פרוס ב-Vercel

1. לך ל-vercel.com
2. התחבר עם GitHub
3. לחץ "New Project"
4. בחר את הריפו
5. לחץ "Deploy"
6. זהו!

## מה יש באתר?

- 🏠 **בית** - Hero עם CTA
- 👨‍⚕️ **אודות** - השכלה, ניסיון
- 💊 **שירותים** - 6 שירותים עם מחירים
- ⭐ **המלצות** - 3 המלצות
- 📍 **צור קשר** - מפה, טלפון, WhatsApp
- 📅 **קביעת תור** - טופס פשוט
- 💬 **צ׳אטבוט** - עוזר וירטואלי

## תכונות

- ✅ עיצוב מודרני
- ✅ Responsive (נייד + מחשב)
- ✅ RTL (עברית)
- ✅ צ׳אטבוט חכם
- ✅ ניווט Waze + Google Maps
- ✅ טופס קביעת תור
- ✅ SEO בסיסי
- ✅ מהיר - ללא dependencies

## קבצים

```
index.html  - כל התוכן
style.css   - כל העיצוב
script.js   - כל הפונקציות
README.md   - המדריך הזה
```

## התאמה אישית

### שינוי צבעים
בקובץ `style.css` בשורות 9-10

### שינוי שירותים
בקובץ `index.html` חפש `services-grid`

### שינוי טקסט
בקובץ `index.html` פשוט ערוך את הטקסט

### הוספת תמונות
1. צור תיקיית `images`
2. העלה תמונות
3. שנה ב-HTML: `<img src="images/doctor.jpg">`

## שילוב עם API אמיתי

לשלוח טפסים לשרת:

```javascript
// In script.js, update handleSubmit:
async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    try {
        const response = await fetch('/api/appointment', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            alert('✅ התור נקבע בהצלחה!');
        }
    } catch (error) {
        alert('❌ שגיאה. נסה שוב.');
    }
}
```

## תמיכה

פשוט, נקי, עובד!

זה הכל! 🎉


---

## Back Office (ניהול בקשות תור)

נוספה מערכת Back Office בסיסית שמציגה את כל הבקשות שנשלחו מהטופס:

- קובץ: `admin.html`
- גישה: `https://YOUR_DOMAIN/admin.html`
- כולל: חיפוש, סינון סטטוס, שינוי סטטוס, מחיקה, וייצוא CSV.

⚠️ חשוב: זו גרסה "קלה" ששומרת נתונים ב-`localStorage` של הדפדפן (רק באותו מחשב/דפדפן).
ל-Back Office אמיתי (רב-משתמשים/נגיש מכל מקום) צריך שרת/DB (למשל Supabase / Firebase / Google Sheets).
