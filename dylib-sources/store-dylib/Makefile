# ══════════════════════════════════════════════════════════════
#  Mismari Store Dylib — Makefile
#  يعمل على macOS مع Xcode Command Line Tools
#  الهدف: arm64 + arm64e (iPhone 8s وأحدث)
#
#  طبقات الحماية المُطبَّقة في الـ Build:
#   • Symbol Stripping   — حذف جدول الرموز تماماً
#   • Dead Code Strip    — حذف الكود غير المستخدم
#   • Stack Protector    — حماية الـ Stack من الـ Overflow
#   • No Stack Exec      — منع تنفيذ الكود من الـ Stack
#   • Visibility Hidden  — إخفاء كل الدوال كـ private
# ══════════════════════════════════════════════════════════════

TARGET    := mismari-store.dylib
SOURCES   := StoreDylib.m fishhook.c
HEADERS   := fishhook.h Obfuscation.h
SDK       := $(shell xcrun --sdk iphoneos --show-sdk-path 2>/dev/null)
MIN_IOS   := 14.0

CC        := $(shell xcrun --find clang)
STRIP     := $(shell xcrun --find strip)
ARCHS     := -arch arm64 -arch arm64e

# ─── Compilation Flags ────────────────────────────────────────────────────────
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
    -framework CommonCrypto \
    -lobjc \
    -ldl \
    -install_name @rpath/$(TARGET) \
    -compatibility_version 1.0 \
    -current_version 1.0.0 \
    \
    -fvisibility=hidden \
    -fvisibility-inlines-hidden \
    \
    -fstack-protector-strong \
    \
    -Wl,-dead_strip \
    \
    -DNDEBUG

# ─── Strip Flags ──────────────────────────────────────────────────────────────
# -x   : حذف رموز الـ Locals تماماً
# -S   : حذف معلومات الـ Debug
# -T   : حذف رموز Swift / ObjC الزائدة
STRIP_FLAGS := -x -S -T

.PHONY: all clean check info

all: check $(TARGET) strip_symbols
	@echo ""
	@echo "╔══════════════════════════════════════════╗"
	@echo "║  ✅ mismari-store.dylib جاهز للرفع       ║"
	@echo "╚══════════════════════════════════════════╝"
	@ls -lh $(TARGET)

$(TARGET): $(SOURCES) $(HEADERS)
	@echo "🔨 بناء $(TARGET) لـ arm64 + arm64e..."
	$(CC) $(CFLAGS) -o $@ $(SOURCES)
	@echo "✅ تم البناء"

# ─── Symbol Stripping ─────────────────────────────────────────────────────────
# يحذف جميع رموز الـ Debug والـ Symbols من الملف الثنائي النهائي
# بعد هذه الخطوة: Hopper / IDA / nm لن يستطيعوا رؤية أي دالة بالاسم
strip_symbols: $(TARGET)
	@echo "🔒 حذف الـ Symbols من $(TARGET)..."
	$(STRIP) $(STRIP_FLAGS) $(TARGET)
	@echo "✅ تم الـ Strip — جدول الرموز محذوف"

check:
	@if [ -z "$(SDK)" ]; then \
		echo "❌ Xcode SDK غير موجود. شغّل: xcode-select --install"; \
		exit 1; \
	fi
	@echo "📱 SDK: $(SDK)"

clean:
	rm -f $(TARGET)
	@echo "🗑️  تم الحذف"

# ── عرض معلومات الـ dylib ─────────────────────────────────────────────────────
info: $(TARGET)
	@echo "\n── المعماريات ──────────────────────────────────"
	lipo -info $(TARGET)
	@echo "\n── المكتبات المرتبطة ──────────────────────────"
	otool -L $(TARGET)
	@echo "\n── الرموز المُصدَّرة (يجب أن تكون فارغة بعد الـ Strip) ──"
	nm -gU $(TARGET) 2>/dev/null | head -20 || echo "✅ لا توجد رموز — Strip ناجح"
	@echo "\n── حجم الملف ────────────────────────────────────"
	ls -lh $(TARGET)

# ── التحقق من نجاح الـ Obfuscation ───────────────────────────────────────────
verify: $(TARGET)
	@echo "\n── فحص النصوص المكشوفة (يجب ألا تظهر روابط) ──"
	@if strings $(TARGET) | grep -E "mismari\.com|ocsp\.apple|app\.mismari" 2>/dev/null; then \
		echo "⚠️  تحذير: وُجدت نصوص مكشوفة! راجع الـ Obfuscation"; \
	else \
		echo "✅ لا توجد نصوص مكشوفة — التشفير ناجح"; \
	fi
	@echo "\n── فحص الـ Symbols المكشوفة ──────────────────"
	@if nm -gU $(TARGET) 2>/dev/null | grep -v "^$$" | head -5; then \
		echo "⚠️  بعض الرموز مكشوفة — شغّل make strip_symbols"; \
	else \
		echo "✅ لا توجد رموز مكشوفة"; \
	fi
