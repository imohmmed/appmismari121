# ══════════════════════════════════════════════════════════
#  Mismari Store Dylib — Makefile
#  يعمل على macOS مع Xcode Command Line Tools
#  الهدف: arm64 + arm64e (iPhone 8s وأحدث)
# ══════════════════════════════════════════════════════════

TARGET    := mismari-store.dylib
SOURCES   := StoreDylib.m fishhook.c
SDK       := $(shell xcrun --sdk iphoneos --show-sdk-path 2>/dev/null)
MIN_IOS   := 14.0

CC        := $(shell xcrun --find clang)
ARCHS     := -arch arm64 -arch arm64e

CFLAGS    := \
    $(ARCHS) \
    -isysroot $(SDK) \
    -miphoneos-version-min=$(MIN_IOS) \
    -dynamiclib \
    -fPIC \
    -fobjc-arc \
    -O2 \
    -framework Foundation \
    -framework UIKit \
    -lobjc \
    -install_name @rpath/$(TARGET) \
    -compatibility_version 1.0 \
    -current_version 1.0.0

.PHONY: all clean check

all: check $(TARGET)

$(TARGET): $(SOURCES) fishhook.h
	@echo "🔨 Building $(TARGET) for arm64 + arm64e..."
	$(CC) $(CFLAGS) -o $@ $(SOURCES)
	@echo "✅ Done: $(TARGET)"
	@echo ""
	@ls -lh $(TARGET)

check:
	@if [ -z "$(SDK)" ]; then \
		echo "❌ Xcode SDK not found. Run: xcode-select --install"; \
		exit 1; \
	fi
	@echo "📱 SDK: $(SDK)"

clean:
	rm -f $(TARGET)
	@echo "🗑️  Cleaned"

# ── عرض معلومات الـ dylib ─────────────────────────────────────────────────────
info: $(TARGET)
	@echo "\n── Architectures ──────────────────────────────"
	lipo -info $(TARGET)
	@echo "\n── Linked Frameworks ──────────────────────────"
	otool -L $(TARGET)
	@echo "\n── Exported Symbols ────────────────────────────"
	nm -gU $(TARGET) | head -30
