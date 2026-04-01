ARCHS         = arm64 arm64e
TARGET        = iphone:clang:16.5:14.0

TWEAK_NAME    = MismariProtect

MismariProtect_FILES       = Tweak.x
MismariProtect_FRAMEWORKS  = Foundation UIKit Security
MismariProtect_LIBRARIES   = substrate

MismariProtect_CFLAGS = -fobjc-arc -O2 -flto -std=c11 -fvisibility=hidden -ffunction-sections -fdata-sections -DNDEBUG -Wno-deprecated-declarations

MismariProtect_LDFLAGS = -flto -Wl,-S -Wl,-dead_strip -Wl,-x

STRIP_INSTALLED_PRODUCT = YES

include $(THEOS)/makefiles/common.mk
include $(THEOS_MAKE_PATH)/tweak.mk

after-all::
        @DYLIB=$$(find .theos -name "MismariProtect.dylib" ! -path "*/arm64/*" ! -path "*/arm64e/*" 2>/dev/null | head -1); \
        if [ -z "$$DYLIB" ]; then \
                DYLIB=$$(find .theos -name "MismariProtect.dylib" 2>/dev/null | tail -1); \
        fi; \
        if [ -n "$$DYLIB" ]; then \
                cp "$$DYLIB" ./antirevoke.dylib && \
                echo "" && \
                echo "==> antirevoke.dylib ready" && \
                ls -lh ./antirevoke.dylib; \
        else \
                echo "ERROR: MismariProtect.dylib not found"; \
        fi

verify: antirevoke.dylib
        @echo "--- Strings check (should be empty) ---"
        @strings antirevoke.dylib | grep -E "ocsp\.apple|crl\.apple|frida|DYLD_INSERT" || echo "OK: no plain strings"
        @echo "--- Architectures ---"
        @lipo -info antirevoke.dylib
        @echo "--- Linked libs ---"
        @otool -L antirevoke.dylib

# ════════════════════════════════════════════════════════════════
#  release — Production build مع FINALPACKAGE=1 (الإلزامي للنشر)
#
#  ⚠️  لا ترفع أبداً نسخة Debug للمشتركين.
#      FINALPACKAGE=1 يضمن: NDEBUG مُعرَّف · لا Symbols · lipo مُدمج
#
#  ⚠️  antirevoke.dylib يُضاف لتطبيقات المستخدمين فقط —
#      لا تضعه في Store App (Hermes/React Native crash)
#
#  الاستخدام:
#    make release
#    # أو عبر السكريبت الكامل:
#    python3 tools/rotate_keys.py --build-ark --upload-ark ...
# ════════════════════════════════════════════════════════════════
release:
        @echo ""
        @echo "╔══════════════════════════════════════════════════════╗"
        @echo "║   PRODUCTION BUILD — FINALPACKAGE=1                 ║"
        @echo "║   Anti-Revoke · 9 modules · arm64 + arm64e          ║"
        @echo "║   ⚠️  للتطبيقات فقط — لا للـ Store App              ║"
        @echo "╚══════════════════════════════════════════════════════╝"
        @echo ""
        $(MAKE) FINALPACKAGE=1
        @echo ""
        @echo "✓ antirevoke.dylib جاهز — شغّل 'make verify' للتحقق"
