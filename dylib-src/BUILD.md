# بناء Mismari Protect Dylib v3.0

## الـ Modules (10 وحدات حماية)

| # | الاسم | الوظيفة |
|---|---|---|
| 1 | Anti-Debugging | ptrace + sysctl — يمنع lldb/frida/cycript |
| 2 | OCSP Block | يحجب التحقق من إلغاء الشهادة |
| 3 | SSL Unpinning | يقبل أي شهادة SSL |
| 4 | Bundle ID Guard | يخفي أن التطبيق مثبت خارج App Store |
| 5 | Fake Device Info | IDFV=nil، Device Name جنيريك |
| 6 | File Path Shadow | يخفي مسارات Cydia/Substrate/Tweaks |
| 7 | Background AutoKill | ينهي Background Tasks بعد ثانيتين |
| 8 | URL Scheme Filter | يحجب canOpenURL لـ JB apps |
| 9 | Env Variable Hide | يخفي DYLD_INSERT_LIBRARIES وغيرها |
| 10 | Swizzle Ghost | يُخفي الـ hooks عن method_getImplementation |

## المتطلبات (على الماك)
```bash
# تثبيت Theos (مرة واحدة)
bash -c "$(curl -fsSL https://raw.githubusercontent.com/theos/theos/master/bin/install-theos)"
```

## البناء
```bash
cd dylib-src
make
# الناتج: ./antirevoke.dylib  (arm64 + arm64e)
```

## ترميز نص جديد للـ MSMStrings.h
```bash
python3 encode.py "your.new.string"
# ثم أضف الناتج في MSMStrings.h كـ #define جديد
```

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

## رفع الملف للمتجر
بعد البناء، ارفع `antirevoke.dylib` من صفحة الإعدادات في لوحة التحكم.

## التحقق من إخفاء الرموز
```bash
nm antirevoke.dylib          # يجب أن يكون الناتج فارغاً أو شبه فارغ
strings antirevoke.dylib     # لا يجب أن تظهر نصوص مثل: ocsp.apple.com أو DYLD_INSERT_LIBRARIES
otool -L antirevoke.dylib    # التحقق من المكتبات المرتبطة
```
