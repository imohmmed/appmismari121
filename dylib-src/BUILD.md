# بناء Mismari Protect Dylib v4.2

## الـ Modules (11 وحدة حماية)

| # | الاسم | الوظيفة |
|---|---|---|
| 1 | Anti-Debugging | ptrace فقط — يمنع lldb/frida/cycript (P_TRACED check محذوف — كان يُسبّب crash على developer profile) |
| 2 | OCSP Block | يحجب التحقق من إلغاء الشهادة |
| 3 | SSL Unpinning | يقبل أي شهادة SSL |
| 4 | Bundle ID Guard | يخفي أن التطبيق مثبت خارج App Store |
| 5 | Fake Device Info | IDFV وهمي، Device Name جنيريك |
| 6 | File Path Shadow | يخفي مسارات Cydia/Substrate/Tweaks |
| 7 | (محذوف) Background AutoKill | كان يكسر اليوتيوب/سبوتيفاي |
| 8 | URL Scheme Filter | يحجب canOpenURL لـ JB apps |
| 9 | Env Variable Hide | يخفي DYLD_INSERT_LIBRARIES وغيرها |
| 10 | Swizzle Ghost | يُخفي الـ hooks عن method_getImplementation |
| 11 | **DYLD Image Cloaking** | **يُخفي الدايلب من _dyld_image_count/name — يتجاوز Hybrid Detection** |

### ⚠️ تغييرات مهمة في v4.1

| المشكلة | السبب | الإصلاح |
|---|---|---|
| `exit(0)` فوري عند الفتح | `P_TRACED` sysctl يعطي false positive على Developer Profile | حذف sysctl check — فقط `ptrace(PT_DENY_ATTACH)` |
| `LC_ID_DYLIB` خاطئ | Theos يضعه كمسار MobileSubstrate | `-install_name @executable_path/antirevoke.dylib` في LDFLAGS |
| `patch_weak.py` ناقص | لم يكن يصحّح LC_ID_DYLIB | أُضيف تصحيح LC_ID_DYLIB تلقائياً |

---

## ⚡ الطريقة الجديدة (v4.2) — بدون Theos

إذا كان Theos ينتج بايناري تالف (constructor pointer garbage)، استخدم هذا:

```bash
cd dylib-src

# Debug
make -f Makefile.plain

# Production (بدون symbols — للنشر)
make -f Makefile.plain release

# التحقق
make -f Makefile.plain verify
```

لا يحتاج Theos ولا Logos — `xcrun clang` المثبت مع Xcode يكفي.

---

## الطريقة القديمة (Theos) — إذا كانت تعمل عندك

```bash
# تثبيت Theos (مرة واحدة)
bash -c "$(curl -fsSL https://raw.githubusercontent.com/theos/theos/master/bin/install-theos)"

# التحقق من التثبيت
echo $THEOS
theos --version
```

---

## البناء

### Debug (للاختبار فقط)
```bash
cd dylib-src
make
# الناتج: ./antirevoke.dylib  (arm64 + arm64e)
```

### ✅ Release (للنشر الفعلي — هذا الأمر الصحيح)
```bash
cd dylib-src
make release
# الناتج: ./antirevoke.dylib  (optimized · no symbols · arm64 + arm64e)
```

---

## التحقق بعد البناء

```bash
# 1. التحقق من LC_ID_DYLIB — يجب أن يكون @executable_path/antirevoke.dylib
otool -l antirevoke.dylib | grep -A3 LC_ID_DYLIB

# 2. التحقق من عدم وجود Substrate dependency
otool -L antirevoke.dylib
# يجب ألا تظهر: CydiaSubstrate أو MobileSubstrate

# 3. التحقق من عدم وجود TLV sections (crash على non-jailbreak)
otool -l antirevoke.dylib | grep -i thread_vars || echo "OK: no TLV"

# 4. Architectures
lipo -info antirevoke.dylib
# المطلوب: arm64 arm64e

# 5. لا نصوص مكشوفة
strings antirevoke.dylib | grep -E "ocsp\.apple|mismari\.com|DYLD_INSERT"
# يجب أن يكون الناتج فارغاً

# أو شغّل الأمر الشامل:
make verify
```

---

## رفع الدايلب للسيرفر

بعد التحقق:
1. افتح لوحة التحكم → الإعدادات → الدايلب
2. ارفع `antirevoke.dylib`

أو مباشرةً عبر SSH:
```bash
# رفع للـ VPS
scp ./antirevoke.dylib root@45.67.216.177:/opt/mismari/artifacts/api-server/uploads/dylibs/antirevoke.dylib
```

---

## ترميز نص جديد للـ MSMStrings.h

```bash
python3 encode.py "your.new.string"
# ثم أضف الناتج في MSMStrings.h كـ #define جديد
```

---

## أنواع Buffer في MSMStrings.h

### MSM_STACK — للـ hooks عالية التكرار (stat/access/getenv...)
```objc
MSM_STACK(myVar, S_MY_DEFINE);
// استخدم myVar مباشرةً — لا free مطلوب — ينظّف نفسه عند نهاية الـ scope
if (strcmp(path, myVar) == 0) { ... }
```

### MSM_S — للمقارنات الطويلة (OCSP block, URL checks...)
```objc
char *s = MSM_S(S_OCSP1);
if (s && strcmp(host, s) == 0) { ... }
free(s); // ← مطلوب دائماً!
```

---

## التحقق من إخفاء الرموز
```bash
nm antirevoke.dylib          # يجب أن يكون الناتج فارغاً أو شبه فارغ
strings antirevoke.dylib     # لا يجب أن تظهر نصوص مثل: ocsp.apple.com
otool -L antirevoke.dylib    # التحقق من المكتبات المرتبطة
```
