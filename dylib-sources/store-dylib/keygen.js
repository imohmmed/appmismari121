#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  Mismari Store Dylib — XOR Key Generator
//  يولّد defines جاهزة للنسخ في Obfuscation.h
//  الاستخدام: node keygen.js [KEY_HEX]
//  مثال:      node keygen.js 0xCD
// ═══════════════════════════════════════════════════════════════════════════

const KEY = parseInt(process.argv[2] || "0xAB", 16) & 0xFF;
console.log(`\nXOR Key: 0x${KEY.toString(16).toUpperCase().padStart(2,"0")}\n`);

// ─── النصوص الحساسة ────────────────────────────────────────────────────────
const strings = {
  UPDATE_URL:  "https://app.mismari.com/api/settings",
  STORE_URL:   "https://app.mismari.com",
  UPDATE_KEY:  "storeVersion",
  VERSION_KEY: "MSStoreDylibVersion",
  CRASH_KEY:   "MSStoreCrashCount",
  LASTRUN_KEY: "MSStoreLastRunSuccess",
  WELCOME_KEY: "MSStoreWelcomedVersion",
  BUNDLE_ID:   "com.mismari.app",
  STORE_NOTES: "storeNotes",
  CF_VERSION:  "CFBundleShortVersionString",
};

// ─── مسارات الجيلبريك ──────────────────────────────────────────────────────
const jbPaths = [
  "/Applications/Cydia.app",
  "/Applications/blackra1n.app",
  "/Applications/FakeCarrier.app",
  "/Applications/Icy.app",
  "/Applications/IntelliScreen.app",
  "/Applications/MxTube.app",
  "/Applications/RockApp.app",
  "/Applications/SBSettings.app",
  "/Applications/Sileo.app",
  "/Applications/Zebra.app",
  "/Library/MobileSubstrate/MobileSubstrate.dylib",
  "/Library/MobileSubstrate/DynamicLibraries/LiveClock.plist",
  "/Library/MobileSubstrate/DynamicLibraries/Veency.plist",
  "/private/var/lib/apt",
  "/private/var/lib/cydia",
  "/private/var/mobile/Library/SBSettings/Themes",
  "/private/var/stash",
  "/private/var/tmp/cydia.log",
  "/usr/bin/sshd",
  "/usr/libexec/sftp-server",
  "/usr/sbin/sshd",
  "/etc/apt",
  "/bin/bash",
  "/bin/sh",
];

function xorEncode(str) {
  return Array.from(str).map(c =>
    "0x" + (c.charCodeAt(0) ^ KEY).toString(16).padStart(2,"0").toUpperCase()
  ).join(",") + ",0x00";
}

// ─── توليد الـ defines ─────────────────────────────────────────────────────
console.log("// ─── ضع هذا في Obfuscation.h ─────────────────────────────────────────────\n");
console.log(`#define _XK ((unsigned char)0x${KEY.toString(16).toUpperCase().padStart(2,"0")})\n`);

for (const [name, str] of Object.entries(strings)) {
  const enc = xorEncode(str);
  const len = str.length + 1;
  console.log(`// "${str}"`);
  console.log(`#define _ENC_${name} {${enc}}`);
  console.log(`#define _LEN_${name} ${len}`);
  console.log();
}

console.log("// ─── مسارات الجيلبريك ───────────────────────────────────────────────────────\n");
jbPaths.forEach((p, i) => {
  const enc = xorEncode(p);
  const len = p.length + 1;
  console.log(`// "${p}"`);
  console.log(`#define _EP${i.toString().padEnd(2)} {${enc}}`);
  console.log(`#define _LP${i.toString().padEnd(2)} ${len}`);
  console.log();
});

console.log(`#define _JB_PATH_COUNT ${jbPaths.length}`);
console.log("\n// تحقق: انسخ النتيجة في Obfuscation.h وعدّل _XK ليطابق المفتاح أعلاه");
