# دليل بناء Mismari Store Dylib على Mac

## متطلبات البيئة

| الأداة | الإصدار | التثبيت |
|-------|---------|---------|
| macOS | 13+ (Ventura أو أحدث) | - |
| Xcode | 15+ | App Store |
| Command Line Tools | أحدث | `xcode-select --install` |

---

## الخطوة 1 — تثبيت Xcode Tools

```bash
# 1. افتح Terminal
# 2. شغّل الأمر التالي
xcode-select --install

# إذا طلب منك Xcode يجب يكون مثبت — نزّله من App Store أولاً
# بعد التثبيت، تحقق
xcrun --sdk iphoneos --show-sdk-path
# يجب يطبع مسار مثل: /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/...
```

---

## الخطوة 2 — نسخ ملفات المشروع

ضع هذه الملفات في مجلد واحد على الـ Mac:

```
~/Desktop/mismari-store-dylib/
├── StoreDylib.m       ← الكود الرئيسي
├── fishhook.h         ← مكتبة الـ hooks
├── fishhook.c         ← تنفيذ fishhook
└── Makefile           ← سكريبت البناء
```

---

## الخطوة 3 — البناء

```bash
# انتقل للمجلد
cd ~/Desktop/mismari-store-dylib

# شغّل البناء
make

# يجب تظهر رسالة مثل:
# 📱 SDK: /Applications/Xcode.app/.../iPhoneOS17.x.sdk
# 🔨 Building mismari-store.dylib for arm64 + arm64e...
# ✅ Done: mismari-store.dylib
# -rwxr-xr-x  1 user  staff  425K  mismari-store.dylib
```

---

## الخطوة 4 — التحقق من الـ dylib

```bash
# تحقق من الأرقام المعمارية (يجب يكون arm64 + arm64e)
make info

# أو يدوياً
lipo -info mismari-store.dylib
# Output: Architectures in the fat file: mismari-store.dylib are: arm64 arm64e

# تحقق من الـ Frameworks المرتبطة
otool -L mismari-store.dylib
```

---

## الخطوة 5 — الرفع على المنصة

بعد البناء، ارفع الـ `mismari-store.dylib` من لوحة الأدمن:
- **المسار على R2**: `dylibs/mismari-store.dylib`
- ⚠️ **هذا الـ dylib للمتجر فقط** — لا يُحقن في تطبيقات المستخدمين

---

## الخطوة 6 — تحديث الكود في الـ API

في `sign.ts`، عند توقيع `Mismari+` (المتجر):
```typescript
// استخدم mismari-store.dylib (للمتجر فقط)
const STORE_DYLIB = "mismari-store.dylib";

// للتطبيقات → استخدم antirevoke.dylib (المختلف)
const APP_DYLIB = "antirevoke.dylib";
```

---

## تفاصيل الميزات

### 1. JB Detection Bypass
يخفي هذه المسارات عن التطبيق:
```
/Applications/Cydia.app
/usr/sbin/sshd
/private/var/lib/apt
... (22 مسار)
```
يستخدم `fishhook` لـ hook مستوى C: `stat`, `lstat`, `access`, `open`

### 2. NSFileManager Protection
يعمل بـ Method Swizzling على:
- `fileExistsAtPath:`
- `fileExistsAtPath:isDirectory:`

### 3. Auto-Update Reminder
- يفحص: `https://app.mismari.com/api/settings`
- يبحث عن مفتاح `storeVersion` في الـ JSON
- أول فحص: 5 ثوانٍ بعد الفتح
- تكرار: كل 30 دقيقة

لإرسال إشعار تحديث، أضف في Settings API:
```json
{
  "storeVersion": "2.0.0",
  "storeNotes": "إصلاحات وتحسينات رائعة!"
}
```

### 4. Bundle ID Masking
يضمن أن `[NSBundle mainBundle].bundleIdentifier` يُعيد دائماً:
```
com.mismari.app
```
لا يؤثر على باقي الـ Bundles ولا على UDID.

### 5. Safe Mode
- يعدّ الـ Crashes المتتالية (التشغيل < 8 ثوانٍ = crash محتمل)
- بعد 3 crashes → يُعطّل جميع الـ Hooks ويظهر تنبيه
- المستخدم يضغط "حسناً" → يُعيد ضبط العداد

### 6. Welcome Message
- يظهر مرة واحدة فقط لكل إصدار جديد
- يُحفظ الـ state في `NSUserDefaults`

---

## الفرق بين الـ Dylibs

| | `mismari-store.dylib` | `antirevoke.dylib` |
|--|--|--|
| **للـ** | Mismari+ (المتجر) | تطبيقات المستخدمين |
| **JB Bypass** | ✅ | ✅ |
| **Auto-Update** | ✅ (يتحقق من API) | ❌ |
| **Welcome MSG** | ✅ (مرة لكل إصدار) | ❌ |
| **Safe Mode** | ✅ | ❌ |
| **Bundle Mask** | ✅ (com.mismari.app) | ❌ |
| **Anti-Revoke** | ❌ (يسبب crash للمتجر) | ✅ |

---

## استكشاف الأخطاء

**خطأ: SDK not found**
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

**خطأ: clang not found**
```bash
xcode-select --install
```

**الـ dylib لا يعمل بعد الحقن**
- تأكد أن iOS target هو 14.0 أو أحدث
- تأكد من arm64 + arm64e: `lipo -info mismari-store.dylib`
- تحقق من السجلات: `Console.app` على Mac، فلتر بـ "MismariStore"
