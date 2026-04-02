ARCHS         = arm64 arm64e
TARGET        = iphone:clang:16.5:14.0

TWEAK_NAME    = MismariProtect

# ── Source files ──────────────────────────────────────────────────────────────
# Tweak.x      → business logic (Logos hooks — تُوجِّه MSHookMessageEx/MSHookFunction
# fishhook.c   → Facebook fishhook: rebind C symbol stubs بدون jailbreak
# substrate_shim.m → يوفر MSHookFunction + MSHookMessageEx عبر fishhook + ObjC runtime
MismariProtect_FILES      = Tweak.x fishhook.c substrate_shim.m

MismariProtect_FRAMEWORKS = Foundation UIKit Security

# ── لا نربط بـ CydiaSubstrate —
# substrate_shim.m يوفر MSHookFunction و MSHookMessageEx مباشرةً.
# الـ patch_weak.py يجعل أي مرجع تلقائي لـ Substrate اختيارياً (weak).
# MismariProtect_LIBRARIES = substrate   ← ← ← مُعطَّل عمداً

MismariProtect_CFLAGS = \
  -fobjc-arc \
  -O2 \
  -flto \
  -std=c11 \
  -fvisibility=hidden \
  -ffunction-sections \
  -fdata-sections \
  -DNDEBUG \
  -Wno-deprecated-declarations

MismariProtect_LDFLAGS = \
  -flto \
  -Wl,-S \
  -Wl,-dead_strip \
  -Wl,-x

STRIP_INSTALLED_PRODUCT = YES

include $(THEOS)/makefiles/common.mk
include $(THEOS_MAKE_PATH)/tweak.mk

# ── Post-build ─────────────────────────────────────────────────────────────────
after-all::
	@DYLIB=$$(find .theos -name "MismariProtect.dylib" ! -path "*/arm64/*" ! -path "*/arm64e/*" 2>/dev/null | head -1); \
	if [ -z "$$DYLIB" ]; then \
		DYLIB=$$(find .theos -name "MismariProtect.dylib" 2>/dev/null | tail -1); \
	fi; \
	if [ -n "$$DYLIB" ]; then \
		cp "$$DYLIB" ./antirevoke.dylib; \
	else \
		echo "ERROR: MismariProtect.dylib not found"; exit 1; \
	fi
	@echo ""
	@echo "==> Patching Substrate dependency to WEAK (no-crash on non-jailbreak)..."
	@python3 patch_weak.py ./antirevoke.dylib
	@echo ""
	@echo "==> antirevoke.dylib ready"
	@ls -lh ./antirevoke.dylib

verify: antirevoke.dylib
	@echo "--- Strings check (should be empty) ---"
	@strings antirevoke.dylib | grep -E "ocsp\.apple|crl\.apple|frida|DYLD_INSERT" || echo "OK: no plain strings"
	@echo "--- Architectures ---"
	@lipo -info antirevoke.dylib
	@echo "--- Linked libs ---"
	@otool -L antirevoke.dylib
	@echo "--- TLV check (must be empty) ---"
	@otool -l antirevoke.dylib | grep -A3 thread_vars || echo "OK: no TLV"
	@echo "--- Substrate type (must be LC_LOAD_WEAK_DYLIB not LC_LOAD_DYLIB) ---"
	@otool -l antirevoke.dylib | grep -A2 -B1 Substrate || echo "OK: no Substrate or already weak"

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
# ════════════════════════════════════════════════════════════════
release:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════╗"
	@echo "║   PRODUCTION BUILD — FINALPACKAGE=1                 ║"
	@echo "║   Anti-Revoke · fishhook + ObjC runtime             ║"
	@echo "║   arm64 + arm64e · بدون Substrate dependency        ║"
	@echo "║   ⚠️  للتطبيقات فقط — لا للـ Store App              ║"
	@echo "╚══════════════════════════════════════════════════════╝"
	@echo ""
	$(MAKE) FINALPACKAGE=1
	@echo ""
	@echo "✓ antirevoke.dylib جاهز — شغّل 'make verify' للتحقق"
