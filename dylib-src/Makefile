ARCHS         = arm64 arm64e
TARGET        = iphone:clang:16.5:14.0

TWEAK_NAME    = MismariProtect

MismariProtect_FILES      = Tweak.x fishhook.c substrate_shim.m

MismariProtect_FRAMEWORKS = Foundation UIKit Security

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
	-Wl,-no_fixup_chains \
	-Wl,-install_name,@executable_path/antirevoke.dylib

STRIP_INSTALLED_PRODUCT = NO

include $(THEOS)/makefiles/common.mk
include $(THEOS_MAKE_PATH)/tweak.mk

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
	@echo "==> Patching LC_ID_DYLIB and Substrate dependency..."
	@python3 patch_weak.py ./antirevoke.dylib
	@echo ""
	@echo "==> antirevoke.dylib ready"
	@ls -lh ./antirevoke.dylib

verify: antirevoke.dylib
	@echo "--- Architectures ---"
	@lipo -info antirevoke.dylib
	@echo "--- Linked libs ---"
	@otool -L antirevoke.dylib
	@echo "--- LC_ID_DYLIB ---"
	@otool -l antirevoke.dylib | grep -A3 LC_ID_DYLIB
	@echo "--- TLV check (must be empty) ---"
	@otool -l antirevoke.dylib | grep -i thread_vars || echo "OK: no TLV"
	@echo "--- Strings check ---"
	@strings antirevoke.dylib | grep -E "ocsp\.apple|mismari\.com|DYLD_INSERT" || echo "OK: no plain strings"

release:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════╗"
	@echo "║   PRODUCTION BUILD — FINALPACKAGE=1                 ║"
	@echo "║   arm64 + arm64e · no symbols · LC_ID patched       ║"
	@echo "╚══════════════════════════════════════════════════════╝"
	@echo ""
	$(MAKE) FINALPACKAGE=1
	@echo ""
	@echo "Done — run: make verify"
