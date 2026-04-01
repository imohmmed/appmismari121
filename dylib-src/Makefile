ARCHS         = arm64 arm64e
TARGET        = iphone:clang:16.5:14.0

TWEAK_NAME    = MismariProtect

MismariProtect_FILES       = Tweak.x
MismariProtect_FRAMEWORKS  = Foundation UIKit Security
MismariProtect_LIBRARIES   = substrate

MismariProtect_CFLAGS = -fobjc-arc -O2 -std=c11 -fvisibility=hidden -ffunction-sections -fdata-sections -DNDEBUG -Wno-deprecated-declarations

MismariProtect_LDFLAGS = -Wl,-S -Wl,-dead_strip -Wl,-x

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
