# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  Mismari Protect Dylib — Makefile                                      ║
# ║  Build: make                                                           ║
# ║  Output: .theos/obj/debug/MismariProtect.dylib                        ║
# ╚══════════════════════════════════════════════════════════════════════════╝

# ─── Target ──────────────────────────────────────────────────────────────────
# iOS 14.0 minimum, arm64 + arm64e (iPhone 11+ native)
ARCHS         = arm64 arm64e
TARGET        = iphone:clang:16.5:14.0

# ─── Tweak ───────────────────────────────────────────────────────────────────
TWEAK_NAME    = MismariProtect

MismariProtect_FILES       = Tweak.x
MismariProtect_FRAMEWORKS  = Foundation UIKit Security
MismariProtect_LIBRARIES   = substrate

# ─── Compiler Flags ──────────────────────────────────────────────────────────
# -fobjc-arc         : ARC memory management
# -O2                : Optimize for speed (also helps with obfuscation)
# -fvisibility=hidden: Hide all symbols — لا تظهر أسماء الدوال في binary
# -ffunction-sections: Dead code elimination
# -fdata-sections    : Dead data elimination
MismariProtect_CFLAGS = \
    -fobjc-arc \
    -O2 \
    -fvisibility=hidden \
    -ffunction-sections \
    -fdata-sections \
    -DNDEBUG \
    -Wno-deprecated-declarations

# ─── Linker Flags ────────────────────────────────────────────────────────────
# -S              : Strip ALL symbols من الـ output
# -dead_strip     : حذف الكود غير المستخدم
# -x              : حذف local symbols
MismariProtect_LDFLAGS = \
    -Wl,-S \
    -Wl,-dead_strip \
    -Wl,-x

# ─── Strip after build ───────────────────────────────────────────────────────
# STRIP_INSTALLED_PRODUCT = YES يحذف رموز الـ debug المتبقية
STRIP_INSTALLED_PRODUCT = YES

include $(THEOS)/makefiles/common.mk
include $(THEOS_MAKE_PATH)/tweak.mk

# ─── Post-build: copy dylib to project root ───────────────────────────────────
after-all::
        @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        @echo "✅ Build complete"
        @DYLIB=$$(find .theos -name "MismariProtect.dylib" 2>/dev/null | head -1); \
        if [ -n "$$DYLIB" ]; then \
            cp "$$DYLIB" ./antirevoke.dylib; \
            echo "📦 Output: ./antirevoke.dylib"; \
            SIZE=$$(du -sh ./antirevoke.dylib | cut -f1); \
            echo "📏 Size: $$SIZE"; \
        fi
        @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
