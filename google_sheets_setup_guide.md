# دليل إعداد مزامنة Google Sheets مع Supabase لـ ERP المصنع

يرشدك هذا الدليل بالتفصيل إلى كيفية تهيئة **حساب الخدمة من جوجل (Google Service Account)**، وإعداد متغيرات البيئة في Supabase، وخطوات تشغيل المزامنة التلقائية.

---

## 1. خطوات إعداد Google Service Account

للقراءة والكتابة من جداول جوجل شيتس بشكل آمن ومستمر دون الحاجة لتسجيل دخول تفاعلي متكرر، نستخدم حساب خدمة:

### الخطوة 1.1: إنشاء حساب الخدمة في Google Cloud
1. انتقل إلى منصة مطوري جوجل: [Google Cloud Console](https://console.cloud.google.com).
2. أنشئ مشروعاً جديداً أو اختر مشروعك الحالي.
3. ابحث في شريط البحث عن **Google Sheets API** واضغط **Enable** لتفعيلها.
4. اذهب إلى قائمة **APIs & Services** ثم اختر **Credentials**.
5. اضغط على **Create Credentials** واختبر **Service Account**.
6. أدخل اسماً لحساب الخدمة (مثال: `supabase-sheets-sync`) ثم اضغط **Create and Continue** ثم **Done**.

### الخطوة 1.2: توليد مفتاح الاتصال JSON Key
1. في قائمة حسابات الخدمة، اضغط على الحساب الذي أنشأته للتو لتعديله.
2. انتقل إلى تبويب **Keys** (المفاتيح).
3. اضغط على **Add Key** ثم اختر **Create new key**.
4. حدد صيغة المفتاح **JSON** واضغط **Create**.
5. سيتم تحميل ملف بصيغة `.json` على جهازك يحتوي على بيانات الاعتماد والمفتاح الخاص. **حافظ على سرية هذا الملف**.

### الخطوة 1.3: مشاركة ملفات الشيت مع حساب الخدمة (مهم جداً)
1. افتح ملف الـ JSON الذي قمت بتحميله، وابحث عن حقل البريد الإلكتروني الخاص بحساب الخدمة: `"client_email"` (يكون بصيغة `username@project.iam.gserviceaccount.com`).
2. افتح ملف **Google Sheets الخاص بالأسعار** وملف **التقارير** في متصفحك.
3. اضغط على زر **مشاركة (Share)** في أعلى الصفحة.
4. أضف البريد الإلكتروني لحساب الخدمة المنسوخ أعلاه، واجعله بصلاحية **محرر (Editor)**، ثم اضغط **إرسال/مشاركة**.

---

## 2. ضبط متغيرات البيئة في Supabase

الآن يجب وضع المفتاح الذي قمت بتحميله في إعدادات Supabase لكي تتمكن الدوال السحابية (Edge Functions) من استخدامه للاتصال بجوجل:

### الخطوة 2.1: إعداد المفتاح السري عبر Supabase CLI (الأسهل)
افتح الطرفية (Terminal) في مجلد المشروع، وقم بتشغيل الأمر التالي لتعيين محتوى ملف الـ JSON كمتغير بيئي محمي ومفرود بالكامل (استبدل محتوى الـ JSON ببيانات ملفك بالكامل):

```powershell
# تعيين رمز الوصول الخاص بك لجلسة PowerShell
$env:SUPABASE_ACCESS_TOKEN="رمز_الوصول_الخاص_بك_هنا"

# تعيين محتوى الـ JSON بالكامل كمتغير سري في Supabase
npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{"type": "service_account", "project_id": "...", ...}' --project-ref unaqyacypzsxgjmsilmh
```

### الخطوة 2.2: إعداد المفتاح يدوياً عبر لوحة التحكم
إذا كنت تفضل الإعداد البصري:
1. اذهب إلى لوحة تحكم [Supabase Dashboard](https://supabase.com/dashboard).
2. اختر مشروعك `unaqyacypzsxgjmsilmh`.
3. اذهب إلى **Settings** (الإعدادات) > **Edge Functions**.
4. تحت قسم **Secrets**، اضغط على **Add Secret**.
5. ضع الاسم الكودى: `GOOGLE_SERVICE_ACCOUNT_JSON`.
6. الصق محتوى ملف الـ JSON كاملاً كقيمة للمفتاح، ثم اضغط **Save**.

---

## 3. الخطوات والأوامر القادمة لتشغيل النظام (Next Steps & SQL Commands)

لكي يبدأ النظام في العمل، يجب تزويد قاعدة البيانات بمعرفات جداول الشيتس (Spreadsheet IDs) التي ترغب بالمزامنة والتصدير منها وإليها:

### الخطوة 3.1: الحصول على معرفات الشيت (Spreadsheet IDs)
يمكنك استخراج معرف الشيت من الرابط (URL) الخاص بملف الشيت في المتصفح:
* الرابط يكون بصيغة: `https://docs.google.com/spreadsheets/d/Spreadsheet_ID_Here/edit`
* انسخ القيمة الموجودة بين `/d/` و `/edit` لكلا الملفين (الأسعار والتقارير).

### الخطوة 3.2: إدراج إعدادات الشيت في قاعدة البيانات (SQL Query)
قم بتشغيل الاستعلام التالي في **SQL Editor** بلوحة تحكم Supabase لإدخال إعدادات الربط وتفعيل المزامنة (مع استبدال المعرفات بالقيم الفعلية):

```sql
-- إدراج تهيئة جوجل شيتس الافتراضية
INSERT INTO "GoogleSheetsConfig" (
    id, 
    prices_spreadsheet_id, 
    prices_sheet_name, 
    reports_spreadsheet_id, 
    reports_sheet_name, 
    auto_sync_enabled
)
VALUES (
    '00000000-0000-0000-0000-000000000001', 
    'معرف_ملف_شيت_الأسعار_الفعلية', 
    'أسعار المواد', 
    'معرف_ملف_شيت_التقارير_الفعلية', 
    'التقارير', 
    TRUE
)
ON CONFLICT (id) DO UPDATE SET 
    prices_spreadsheet_id = EXCLUDED.prices_spreadsheet_id,
    reports_spreadsheet_id = EXCLUDED.reports_spreadsheet_id,
    auto_sync_enabled = EXCLUDED.auto_sync_enabled;
```

### الخطوة 3.3: اختبار تشغيل المزامنة
يمكنك الآن تجربة الضغط على زر المزامنة من شاشة "إعدادات جوجل شيتس" في موقع Vercel أو إجراء استدعاء يدوي لاختبار المزامنة الفورية وقراءة سجلات المحاولة في جدول `SyncLog` للتحقق من سلامة الإجراءات.
