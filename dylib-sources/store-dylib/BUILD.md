# Mismari Store Dylib — دليل البناء والتشفير

## الملفات

| الملف | الوصف |
|---|---|
| `StoreDylib.m` | الكود الرئيسي (6 ميزات + 4 طبقات تشفير) |
| `Obfuscation.h` | نظام تشفير النصوص XOR |
| `fishhook.c/.h` | مكتبة Facebook لـ hooking الـ C functions |
| `Makefile` | بناء + Strip + Verify |

---

## طبقات التشفير الأربع

### 1. تشفير النصوص — XOR String Obfuscation

**المشكلة:** أي أداة (`strings`, `Hopper`, `IDA`) تستطيع قراءة الروابط من الملف الثنائي مباشرة.

**الحل:** كل نص حساس مخزَّن كـ bytes مشفّرة بـ XOR (مفتاح `0xAB`):
- الـ URL الخاص بالـ API  
- مسارات الجيلبريك (24 مسار)  
- جميع UserDefaults keys  
- Bundle ID

**كيف يعمل:**
```c
// بدلاً من:
NSString *url = @"https://app.mismari.com/api/settings";

// نستخدم:
XSTR(apiUrl, _ENC_UPDATE_URL, _LEN_UPDATE_URL);
NSURL *url = [NSURL URLWithString:[NSString stringWithUTF8String:apiUrl]];
XSTR_ZERO(apiUrl, _LEN_UPDATE_URL);  // يُمسح من الـ RAM فوراً
```

**النتيجة:** `strings mismari-store.dylib` → لا يجد أي رابط.

---

### 2. إخفاء الدوال — dlsym Runtime Resolution

**المشكلة:** `NSURLSession` المرتبط بشكل ثابت يظهر في جدول الرموز.

**الحل:** استخدام `objc_getClass()` لحل الدوال وقت التشغيل:
```c
// بدلاً من:
NSURLSession *session = [NSURLSession sharedSession];

// نستخدم:
Class sessionClass = objc_getClass("NSURLSession");
NSURLSession *session = [sessionClass sharedSession];
```

**النتيجة:** لا يوجد ارتباط ثابت بـ NSURLSession في جدول الرموز.

---

### 3. Symbol Stripping — حذف جدول الرموز

**يتم تلقائياً عند البناء** (`make` يشغّل `strip` تلقائياً).

**الـ Flags المستخدمة:**
```
strip -x -S -T mismari-store.dylib
```
- `-x` : حذف رموز الـ Locals  
- `-S` : حذف معلومات الـ Debug  
- `-T` : حذف رموز ObjC الزائدة

**الـ Compiler Flags:**
```
-fvisibility=hidden          → كل الدوال private بشكل افتراضي
-fvisibility-inlines-hidden  → الدوال الـ inline أيضاً hidden
-fstack-protector-strong     → حماية الـ Stack من Overflow
-Wl,-dead_strip              → حذف الكود غير المستخدم
```

**النتيجة:** `nm -gU mismari-store.dylib` → لا يجد أي دالة.

---

### 4. Integrity Check — تحقق النزاهة

**يكتشف:**
- حقن خارجي عبر `DYLD_INSERT_LIBRARIES` بمسارات مريبة (`/var/`, `/tmp/`)

**الاستجابة:**
- `gIntegrityFailed = YES` → جميع الـ hooks تتعطل فوراً
- التطبيق يعمل بشكل طبيعي بدون أي تعديل

**Safe Mode (تلقائي):**
- بعد 3 crashes في أقل من 8 ثوانٍ → Safe Mode تلقائي
- يُعطّل جميع الـ hooks لحماية المستخدم
- يعرض رسالة تشرح الوضع

---

## البناء على MacBook

### المتطلبات
```bash
xcode-select --install   # Xcode Command Line Tools
```

### البناء الكامل
```bash
cd ~/Desktop/mismari-store-dylib
make
```

ينفذ:
1. بناء arm64 + arm64e
2. Strip تلقائي للـ Symbols
3. يطبع الحجم النهائي

### التحقق من نجاح التشفير
```bash
make verify
```
يتحقق من:
- ✅ لا توجد روابط مكشوفة
- ✅ لا توجد رموز مكشوفة

### فحص المعلومات
```bash
make info
```
يعرض:
- المعماريات (arm64 / arm64e)
- المكتبات المرتبطة
- الرموز المتبقية (يجب أن تكون فارغة)

### الرفع على R2
بعد البناء الناجح:
```
Cloudflare R2 → dylibs/mismari-store.dylib
```
السيرفر يُنزّله تلقائياً ويحدّث الـ ETag Cache خلال 5 دقائق.

---

## إعادة توليد مفتاح XOR

إذا أردت تغيير مفتاح التشفير (يُنصح بذلك لكل إصدار):

1. عدّل `KEY` في هذا السكريبت:
```javascript
// keygen.js
const KEY = 0xAB; // غيّر هذا
```

2. شغّل:
```bash
node keygen.js
```

3. انسخ الـ `#define` الجديدة في `Obfuscation.h`

4. عدّل `_XK` في `Obfuscation.h` ليطابق المفتاح الجديد

---

## قاعدة مهمة جداً

> ⚠️ **هذا الدايلب حصراً للمتجر (Mismari+)**  
> لا تحقنه في تطبيقات المستخدمين  
> يحتوي على كود يتعارض مع React Native / Hermes  
>  
> **لتطبيقات المستخدمين:** استخدم `antirevoke.dylib` فقط
