# بناء Mismari Store Dylib (Theos)

## المميزات (6 وحدات حماية)

| # | الاسم | الوظيفة |
|---|---|---|
| 1 | JB Bypass (fishhook) | يخفي مسارات Cydia/Substrate — hooks على stat/lstat/access/open |
| 2 | NSFileManager Protection | fileExistsAtPath يُخفي مسارات JB عن الـ Objective-C layer |
| 3 | Bundle ID Masking | يثبّت Bundle ID الأصلي حتى بعد إعادة التوقيع |
| 4 | Auto-Update Checker | يفحص التحديثات كل 30 دقيقة ويعرض Alert للمستخدم |
| 5 | Safe Mode | بعد 3 crashes في 8 ثواني → تعطيل تلقائي للـ hooks |
| 6 | Integrity Check | يكتشف الحقن الخارجي عبر DYLD_INSERT_LIBRARIES |
| + | Welcome Alert | رسالة ترحيب عند أول تشغيل لكل إصدار جديد |

## ⚠️ مهم: لا تُحقن هذا الدايلب في تطبيقات المستخدمين
- فقط لتطبيق مسماري+ (المتجر)
- `antirevoke.dylib` هو الذي يُحقن في تطبيقات المستخدمين والألعاب

## المتطلبات (على الماك)
```bash
# تثبيت Theos (مرة واحدة)
bash -c "$(curl -fsSL https://raw.githubusercontent.com/theos/theos/master/bin/install-theos)"
```

## البناء
```bash
cd dylib-sources/store-dylib
make
# الناتج: ./mismari-store.dylib  (arm64 + arm64e)
```

## التحقق من الجودة
```bash
make verify
# يفحص: النصوص المكشوفة + الرموز + المعماريات + المكتبات
```

## نظام التشفير

### Obfuscation.h — KEY = 0xAB
```objc
// Stack buffer — لا malloc — لا memory leak
XSTR(myVar, _ENC_SOME_STRING, _LEN_SOME_STRING);
// استخدم myVar مباشرةً
XSTR_ZERO(myVar, _LEN_SOME_STRING); // امسح بعد الاستخدام
```

### لإنشاء نص مشفَّر جديد (KEY=0xAB)
```bash
node -e "const K=0xAB; const s='your.string'; console.log('{' + [...s].map(c=>'0x'+(c.charCodeAt(0)^K).toString(16).padStart(2,'0').toUpperCase()).join(',') + ',0x00}')"
```

## الفرق بين الدايلبين

| الخاصية | mismari-store.dylib | antirevoke.dylib |
|---|---|---|
| يُحقن في | مسماري+ (المتجر فقط) | تطبيقات + ألعاب المستخدمين |
| أداة البناء | Theos library.mk | Theos tweak.mk |
| نظام الـ Hooks | fishhook + ObjC Runtime | Cydia Substrate (Logos %hook) |
| تشفير النصوص | XOR KEY=0xAB (Obfuscation.h) | XOR KEY=0x42 (MSMStrings.h) |
| Safe Mode | ✅ بعد 3 crashes | ❌ |
| Auto-Update | ✅ يفحص API المتجر | ❌ |
| Anti-Revoke (OCSP) | ❌ (React Native يتعطل معه) | ✅ 10 Modules |
