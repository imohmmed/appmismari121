# Mismari Store Dylib — Makefile (Theos)
ARCHS       = arm64 arm64e
TARGET      = iphone:clang:16.5:14.0

LIBRARY_NAME = mismari-store

mismari-store_FILES      = StoreDylib.m fishhook.c
mismari-store_FRAMEWORKS = Foundation UIKit CFNetwork
mismari-store_LIBRARIES  = objc dl

mismari-store_CFLAGS = \
        -fobjc-arc \
        -O2 \
        -flto \
        -std=c11 \
        -fvisibility=hidden \
        -fvisibility-inlines-hidden \
        -fstack-protector-strong \
        -ffunction-sections \
        -fdata-sections \
        -DNDEBUG \
        -Wno-deprecated-declarations

mismari-store_LDFLAGS = \
        -flto \
        -Wl,-S \
        -Wl,-dead_strip \
        -Wl,-x

STRIP_INSTALLED_PRODUCT = YES

include $(THEOS)/makefiles/common.mk
include $(THEOS_MAKE_PATH)/library.mk

after-all::
        @DYLIB=$$(find .theos -name "mismari-store.dylib" 2>/dev/null | head -1); \
        if [ -n "$$DYLIB" ]; then \
                cp "$$DYLIB" ./mismari-store.dylib && \
                echo "" && \
                echo "==> mismari-store.dylib ready" && \
                ls -lh ./mismari-store.dylib; \
        else \
                echo "ERROR: dylib not found"; \
        fi

verify: mismari-store.dylib
        @echo "--- Strings check (should be empty) ---"
        @strings mismari-store.dylib | grep -E "mismari\.com|ocsp\.apple|app\.mismari" || echo "OK: no plain strings"
        @echo "--- Architectures ---"
        @lipo -info mismari-store.dylib
        @echo "--- Linked libs ---"
        @otool -L mismari-store.dylib

# ════════════════════════════════════════════════════════════════
#  release — Production build مع FINALPACKAGE=1 (الإلزامي للنشر)
#
#  ⚠️  لا ترفع أبداً نسخة Debug للمشتركين.
#      FINALPACKAGE=1 يضمن: AES إلزامي · لا Symbols · lipo مُدمج
#
#  الاستخدام:
#    make release
#    # أو عبر السكريبت الكامل:
#    python3 tools/rotate_keys.py --build --upload-r2 --update-api ...
# ════════════════════════════════════════════════════════════════
release:
        @echo ""
        @echo "╔══════════════════════════════════════════════════════╗"
        @echo "║   PRODUCTION BUILD — FINALPACKAGE=1                 ║"
        @echo "║   AES mandatory · No symbols · arm64 + arm64e       ║"
        @echo "╚══════════════════════════════════════════════════════╝"
        @echo ""
        $(MAKE) FINALPACKAGE=1
        @echo ""
        @echo "✓ mismari-store.dylib جاهز للنشر — شغّل 'make verify' للتحقق"
