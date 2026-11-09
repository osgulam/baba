# הנגריה של באבא חיים

אתר גלריה לעבודות הנגרות של באבא חיים, שמתארח ב־GitHub Pages.

## איך זה בנוי
- `index.html`, `assets/style.css`, `assets/app.js`: האתר עצמו. אין שלב בנייה ואין תלויות.
- `data/works.json`: רשימת העבודות (שם, קטגוריה, עץ, מידות, שנה, סיפור, תמונות).
- `images/works/`: תמונות שהועלו מהאתר.
- `images/samples/`: תמונות הדוגמה. אפשר למחוק את עבודות הדוגמה מתוך האתר.

## הפעלה (פעם אחת)
1. במאגר ב־GitHub: **Settings ← Pages**.
2. תחת **Build and deployment** בוחרים **Deploy from a branch**, ענף `main`, תיקייה `/ (root)`, ושומרים.
3. אחרי דקה־שתיים האתר זמין בכתובת `https://<user>.github.io/<repo>/`.

אם המאגר פרטי, GitHub Pages דורש מנוי בתשלום. במאגר ציבורי זה חינם.

## הוספת עבודות מהטלפון
1. ב־GitHub: **Settings ← Developer settings ← Personal access tokens ← Fine-grained tokens ← Generate new token**.
2. **Repository access**: רק המאגר הזה. **Permissions ← Contents**: `Read and write`. כדאי לקבוע תוקף ארוך (למשל שנה).
3. באתר, בתחתית הדף: **כניסה לעריכה**, ומדביקים את המפתח. המפתח נשמר רק במכשיר הזה.
4. מופיע כפתור **+ עבודה חדשה**. כל שמירה יוצרת commit במאגר, והאתר מתעדכן לכולם תוך דקה־שתיים.

את המפתח לא שולחים לאף אחד. אפשר לבטל אותו בכל רגע מאותו מסך ב־GitHub.

## דומיין משלכם
מוסיפים דומיין תחת Settings ← Pages ← Custom domain. במקרה כזה צריך למלא את `owner` ו־`repo` ב־`window.SITE_CONFIG` בקובץ `index.html`, כי אי אפשר לזהות אותם מהכתובת.
