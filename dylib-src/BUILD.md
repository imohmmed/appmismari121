# بناء Mismari Protect Dylib

## المتطلبات (على الماك)
```bash
# تثبيت Theos (مرة واحدة)
bash -c "$(curl -fsSL https://raw.githubusercontent.com/theos/theos/master/bin/install-theos)"
```

## البناء
```bash
cd dylib-src
make
# الناتج: ./antirevoke.dylib
```

## ترميز نص جديد للـ MSMStrings.h
```bash
python3 encode.py "your.domain.com"
# ثم أضف الناتج في MSMStrings.h كـ #define جديد
```

## رفع الملف للمتجر
بعد البناء، ارفع `antirevoke.dylib` من صفحة الإعدادات في لوحة التحكم.

## التحقق من إخفاء الرموز
```bash
nm antirevoke.dylib          # يجب أن يكون الناتج فارغاً أو شبه فارغ
strings antirevoke.dylib     # لا يجب أن تظهر نصوص واضحة مثل ocsp.apple.com
otool -L antirevoke.dylib    # التحقق من المكتبات المرتبطة
```
