# ספריית מסמכים

מערכת ניהול מסמכים לעסק — העלאה, קטלוג, חיפוש, צפייה והורדה של קבצים, במקום קלסרים פיזיים.

בנויה על Next.js 16 + TypeScript + Tailwind v4 + Supabase (Database + Storage).
ממשק עברי מלא, RTL, עיצוב משרדי/טיפולי נקי.

---

## הקמה מאפס

### 1. הקמת פרויקט Supabase

1. היכנס ל-<https://supabase.com> ופתח פרויקט חדש.
2. שמור בצד את **Project URL** ואת **service_role** key (Settings → API).
3. ב-SQL Editor הרץ את כל התוכן של [`supabase/schema.sql`](supabase/schema.sql).
   זה ייצור את הטבלאות `document_categories` ו-`documents_library`, אינדקסים, טריגרים, ויטען seed לקטגוריות הראשוניות (שדה חמד / כללי / אבחונים / שונות).
4. ב-Storage → New bucket — צור bucket בשם **`library`** ו**ודא שהוא Private** (לא Public).

### 2. הגדרת משתני סביבה

צור קובץ `.env.local` בשורש הפרויקט (לפי `.env.example`):

```ini
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role-key...
```

> ⚠️ **service_role משמש בצד שרת בלבד.** הוא לעולם לא נחשף ללקוח.

### 3. התקנת תלויות והרצה

```bash
npm install
npm run dev
```

פתח <http://localhost:3000>.

---

## מבנה הפרויקט

```
app/
  layout.tsx                    # שורש עברי + RTL + פונט Heebo
  page.tsx                      # עמוד הספרייה הראשי
  globals.css                   # פלטת צבעים + טוקנים של Tailwind v4
  api/
    document-categories/route.ts            # GET / POST קטגוריות
    documents/route.ts                       # GET רשימה (חיפוש/סינון/מיון)
    documents/upload/route.ts                # POST העלאה יחידה
    documents/upload-many/route.ts           # POST העלאה מרובה
    documents/[id]/route.ts                  # PATCH עריכה, DELETE מחיקה
    documents/[id]/signed-url/route.ts       # POST signed URL זמני

components/library/
  LibraryClient.tsx             # רכיב הראשי (state + פעולות)
  CategoryTabs.tsx              # טאבי קטגוריות (הכל / שדה חמד / …)
  DocumentCard.tsx              # כרטיס מסמך
  UploadModal.tsx               # מודאל העלאה יחידה
  UploadManyModal.tsx           # מודאל העלאה מרובה
  NewCategoryModal.tsx          # מודאל הוספת קטגוריה
  EditDocumentModal.tsx         # מודאל עריכה
  Modal.tsx                     # מודאל בסיסי
  Toast.tsx                     # הודעות הצלחה/שגיאה

lib/
  supabase/admin.ts             # client עם service_role — server only
  types.ts                      # טיפוסי DocumentCategory / Document
  utils.ts                      # פורמט בייטים, תאריך, נתיב Storage

supabase/
  schema.sql                    # SQL להקמה ראשונית של DB
```

---

## בדיקות ידניות

### בדיקת העלאה יחידה
1. לחץ **העלאת מסמך**.
2. בחר קובץ, הזן שם (אופציונלי), בחר קטגוריה ב"שדה חמד".
3. לחץ **העלה**. אמורה להופיע הודעת הצלחה והכרטיס יופיע בעמוד.
4. ב-Supabase Studio → Storage → bucket `library` הקובץ קיים תחת `YYYY/MM/<uuid>_<filename>`.
5. בטבלה `documents_library` יש שורה חדשה עם `file_path` תואם.

### בדיקת העלאה מרובה
1. לחץ **העלאה מרובה**, בחר 3-4 קבצים, בחר קטגוריה.
2. לחץ **העלה N קבצים**.
3. בתחתית המודאל מופיעה רשימה — לכל קובץ ✓ או ✗ עם סיבת השגיאה.
4. רשימת המסמכים בעמוד מתעדכנת.

### בדיקת צפייה/הורדה דרך signed URL
1. **צפייה** על כרטיס: נפתחת לשונית חדשה עם signed URL זמני (10 דקות).
2. **הורדה**: יוצר signed URL עם `download=true` ושומר עם השם המקורי.
3. בכלי הרשת של הדפדפן רואים שה-URL חוזר מ-`POST /api/documents/<id>/signed-url`, ושהוא expirable.

### בדיקת RLS / אבטחה
- ה-bucket Private — ניסיון לפתוח את ה-`file_path` ישירות מ-URL ציבורי יחזיר 403.
- הטבלאות עם RLS פעיל ובלי policies לציבור — anon לא יכול לקרוא דרך ה-API הציבורי של Supabase. כל הגישה היא דרך ה-API שלנו עם service_role בצד שרת.

---

## סטטוס וקופסאות סגורות

- **`patient_id`** קיים בטבלה כהכנה לעתיד — לא מחובר עדיין למודול מטופלות.
- **`uploaded_by`** ריק כרגע (לא נכתב). כשיהיה login — להעביר ב-form ולמלא.
- **מחיקה** היא קשיחה (DELETE מ-DB + Storage). יש שדה `is_archived` להעברה בהמשך ל-soft delete.
- אין כרגע auth — כשיוסיפו, רצוי להוסיף בדיקת session ב-route handlers ולעבור ל-RLS policies לאוטנטיקטד.

---

## פקודות שימושיות

```bash
npm run dev      # שרת פיתוח
npm run build    # build production
npm run start    # הרצה production מקומית
npm run lint     # בדיקת ESLint
```
