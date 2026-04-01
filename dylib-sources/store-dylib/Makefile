# ══════════════════════════════════════════════════════════════════════════════
#  Mismari Store Dylib — Makefile (Theos)
#  يعمل على macOS مع Theos مثبّت
#  الهدف: arm64 + arm64e (iPhone 8 وأحدث)
#
#  طبقات الحماية المُطبَّقة:
#   • Symbol Stripping      — حذف جدول الرموز تماماً (Theos STRIP_INSTALLED_PRODUCT)
#   • Dead Code Strip       — حذف الكود غير المستخدم (-Wl,-dead_strip)
#   • Stack Protector       — حماية الـ Stack من الـ Overflow
#   • Visibility Hidden     — إخفاء كل الدوال كـ private
#   • XOR String Encryption — كل النصوص مشفَّرة في الـ Binary (Obfuscation.h)
#
#  البناء:
#   cd dylib-sources/store-dylib && make
#  الناتج:
#   mismari-store.dylib  (جاهز للرفع في لوحة التحكم)
# ══════════════════════════════════════════════════════════════════════════════

ARCHS       = arm64 arm64e
TARGET      = iphone:clang:16.5:14.0

# نوع المشروع: library (لا يستخدم Logos / %hook — hooks يدوية عبر fishhook + ObjC runtime)
LIBRARY_NAME = mismari-store

mismari-store_FILES       = StoreDylib.m fishhook.c
mismari-store_FRAMEWORKS  = Foundation UIKit
mismari-store_LIBRARIES   = objc dl

mismari-store_CFLAGS = \
    -fobjc-arc \
    -O2 \
    -std=c11 \
    -fvisibility=hidden \
    -fvisibility-inlines-hidden \
    -fstack-protector-strong \
    -ffunction-sections \
    -fdata-sections \
    -DNDEBUG \
    -Wno-deprecated-declarations

mismari-store_LDFLAGS = \
    -Wl,-S \
    -Wl,-dead_strip \
    -Wl,-x

STRIP_INSTALLED_PRODUCT = YES

include $(THEOS)/makefiles/common.mk
include $(THEOS_MAKE_PATH)/library.mk

# ─── نسخ الناتج لاسمه الصحيح ──────────────────────────────────────────────────
# Theos ينتج: mismari-store.dylib في مجلد .theos/obj
after-all::
        @DYLIB=$$(find .theos -name "mismari-store.dylib" 2>/dev/null | head -1); \
        if [ -n "$$DYLIB" ]; then \
            cp "$$DYLIB" ./mismari-store.dylib && \
            echo "" && \
            echo "╔══════════════════════════════════════════╗" && \
            echo "║  ✅ mismari-store.dylib جاهز للرفع       ║" && \
            echo "╚══════════════════════════════════════════╝" && \
            ls -lh ./mismari-store.dylib; \
        else \
            echo "❌ لم يُوجد الناتج — تحقق من الأخطاء أعلاه"; \
        fi

# ── التحقق من نجاح الـ Obfuscation ───────────────────────────────────────────
verify: mismari-store.dylib
        @echo "\n── فحص النصوص المكشوفة (يجب ألا تظهر روابط) ──"
        @if strings mismari-store.dylib | grep -E "mismari\.com|ocsp\.apple|app\.mismari" 2>/dev/null; then \
            echo "⚠️  تحذير: وُجدت نصوص مكشوفة! راجع الـ Obfuscation"; \
        else \
            echo "✅ لا توجد نصوص مكشوفة — التشفير ناجح"; \
        fi
        @echo "\n── فحص الـ Symbols المكشوفة ──────────────────"
        @if nm -gU mismari-store.dylib 2>/dev/null | grep -v "^$$" | head -5; then \
            echo "⚠️  بعض الرموز مكشوفة — Theos STRIP_INSTALLED_PRODUCT=YES يجب أن يحلّها"; \
        else \
            echo "✅ لا توجد رموز مكشوفة"; \
        fi
        @echo "\n── المعماريات ──────────────────────────────────"
        lipo -info mismari-store.dylib
        @echo "\n── المكتبات المرتبطة ────────────────────────────"
        otool -L mismari-store.dylib
