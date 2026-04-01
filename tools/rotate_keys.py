#!/usr/bin/env python3
"""
Mismari Dylib — Key Rotation Tool
===================================
يدوّر مفاتيح XOR في ملفات Obfuscation.h (KEY=0xAB) و MSMStrings.h (KEY=0x42)
ويولّد تعريفات C الجديدة جاهزة للنسخ.

الاستخدام:
  python3 rotate_keys.py --obfuscation 0xBE        # يدوّر مفتاح store-dylib
  python3 rotate_keys.py --antirevoke  0x57        # يدوّر مفتاح antirevoke
  python3 rotate_keys.py --obfuscation 0xBE --antirevoke 0x57  # كلاهما
  python3 rotate_keys.py --aes "NewAES16ByteKey!"  # يدوّر مفتاح AES-128
"""

import argparse
import sys

# ─── الـ CURRENT KEYS ─────────────────────────────────────────────────────────
CURRENT_OBF_KEY = 0xAB   # Obfuscation.h (store-dylib)
CURRENT_ARK_KEY = 0x42   # MSMStrings.h  (antirevoke)
CURRENT_AES_KEY = "Msm@Store#2026!K"   # مفتاح AES-128 (16 بايت)

# ─── قوائم النصوص الأصلية ─────────────────────────────────────────────────────
# كل عنصر: (اسم_الـ_DEFINE, النص_الأصلي)
# هذه القائمة هي "source of truth" — حدّثها عند إضافة strings جديدة.

OBFUSCATION_STRINGS = [
    # Bundle & App
    ("_ENC_BUNDLE_ID",    "com.mismari.app"),
    ("_ENC_UPDATE_URL",   "https://app.mismari.com/api/settings"),
    ("_ENC_UPDATE_URL_V2","https://app.mismari.com/api/v2/dylib/settings"),
    ("_ENC_TELEMETRY_URL","https://app.mismari.com/api/v2/telemetry/proxy"),
    ("_ENC_BASE_URL",     "https://app.mismari.com"),
    # Update / Safe-Mode
    ("_ENC_UPDATE_KEY",   "storeVersion"),
    ("_ENC_STORE_NOTES",  "releaseNotes"),
    ("_ENC_CF_VERSION",   "CFBundleShortVersionString"),
    ("_ENC_CRASH_KEY",    "MSMCrashCount"),
    ("_ENC_LASTRUN_KEY",  "MSMLastRun"),
    ("_ENC_WELCOME_KEY",  "MSMWelcomed"),
    # Proxy detection
    ("_ENC_HTTP_ENABLE",  "HTTPEnable"),
    ("_ENC_HTTPS_ENABLE", "HTTPSEnable"),
    ("_ENC_HTTP_PROXY",   "HTTPProxy"),
    ("_ENC_HTTPS_PROXY",  "HTTPSProxy"),
    ("_ENC_HTTP_PORT",    "HTTPPort"),
    ("_ENC_HTTPS_PORT",   "HTTPSPort"),
    ("_ENC_LOOPBACK",     "127.0.0.1"),
    ("_ENC_LOCALHOST",    "localhost"),
    ("_ENC_PROXY_KEY",    "MSStoreProxyBlock"),
    # AES payload keys
    ("_ENC_MSM_ENC",      "msm_enc"),
    ("_ENC_MSM_IV",       "msm_iv"),
    # JB paths (EP0-EP28) — أسماء مختصرة؛ يُولَّد من قائمة المسارات أدناه
]

# مسارات الـ JailBreak
JB_PATHS = [
    "/Library/MobileSubstrate/",            # EP0
    "/Library/MobileSubstrate/DynamicLibraries/",  # EP1
    "/var/lib/cydia/",                       # EP2
    "/var/lib/dpkg/info/",                   # EP3
    "/usr/libexec/cydia/",                   # EP4
    "/usr/lib/libsubstitute.dylib",          # EP5
    "/usr/lib/substrate/",                   # EP6
    "/usr/lib/tweaks/",                      # EP7
    "/var/mobile/Applications/",             # EP8
    "/var/stash/",                           # EP9
    "/var/checkra1n.dmg",                    # EP10
    "/usr/bin/cycript",                      # EP11
    "/usr/local/bin/cycript",                # EP12
    "/usr/sbin/frida-server",                # EP13
    "/etc/apt/",                             # EP14
    "/bin/bash",                             # EP15
    "/usr/bin/sshd",                         # EP16
    "/usr/sbin/sshd",                        # EP17
    "/etc/ssh/sshd_config",                  # EP18
    "/Applications/Cydia.app",               # EP19
    "/Applications/Sileo.app",               # EP20
    "/Applications/Zebra.app",               # EP21
    "/Applications/Filza.app",               # EP22
    "/bin/sh",                               # EP23
    "/private/preboot/",                     # EP24 (Rootless)
    "/var/jb/",                              # EP25 (Rootless base)
    "/var/jb/usr/",                          # EP26 (Rootless binaries)
    "/var/jb/Library/",                      # EP27 (Rootless tweaks)
    "/.file",                                # EP28 (Dopamine marker)
]

ANTIREVOKE_STRINGS = [
    # OCSP domains
    ("S_OCSP_APPLE",      "ocsp.apple.com"),
    ("S_OCSP_APPLE2",     "ocsp2.apple.com"),
    ("S_CRL_APPLE",       "crl.apple.com"),
    ("S_VALID_APPLE",     "valid.apple.com"),
    # OCSP keywords
    ("S_OCSP_PATH",       "/ocsp"),
    ("S_CRL_PATH",        "/crl"),
    ("S_CERT_PATH",       "/cert"),
    # Device info
    ("S_IDFV_KEY",        "__msm_idfv__"),
    # Env vars (frida/jb)
    ("S_ENV_DYLD",        "DYLD_INSERT_LIBRARIES"),
    ("S_ENV_XCTEST",      "_XCAppTest"),
    ("S_ENV_SUBSTRATE",   "MobileSubstrate"),
    ("S_ENV_SUBSTITUTE",  "Substitute"),
    ("S_ENV_SAFEMODE",    "_MSSafeMode"),
    ("S_ENV_LIBHOOKER",   "LIBHOOKER"),
    ("S_ENV_INJECTION",   "INJECTION_BUNDLE"),
    ("S_ENV_FRIDA",       "frida"),
    ("S_ENV_FRIDA_SRV",   "FRIDA_SERVER"),
    ("S_ENV_FRIDA_GAD",   "FRIDA_GADGET"),
]

# ─── Helper Functions ─────────────────────────────────────────────────────────

def xor_encode(text: str, key: int) -> list[int]:
    return [ord(c) ^ key for c in text]

def format_c_array(encoded: list[int], include_null: bool = True) -> str:
    if include_null:
        encoded = encoded + [0x00]
    return "{" + ",".join(f"0x{b:02X}" for b in encoded) + "}"

def gen_string_defines(name: str, text: str, key: int) -> str:
    enc = xor_encode(text, key)
    arr = format_c_array(enc)
    length = len(text) + 1
    return f"#define {name}     {arr}\n#define {name.replace('_ENC_', '_LEN_')} {length}"

def gen_jb_path_define(idx: int, text: str, key: int) -> str:
    enc = xor_encode(text, key)
    arr = format_c_array(enc)
    length = len(text) + 1
    name = f"_EP{idx}"
    return f"/* {repr(text)} */\n#define {name} {arr}\n#define _LP{idx} {length}"

def gen_aes_define(key_text: str, xor_key: int) -> str:
    enc = xor_encode(key_text, xor_key)
    arr = "{" + ",".join(f"0x{b:02X}" for b in enc) + "}"  # no null for AES key
    return (f"/* AES-128 key: {repr(key_text)} */\n"
            f"#define _ENC_AESKEY  {arr}\n"
            f"#define _LEN_AESKEY  {len(key_text)}")

def gen_antirevoke_define(name: str, text: str, key: int) -> str:
    enc = xor_encode(text, key)
    arr = format_c_array(enc)
    length = len(text) + 1
    return f"MSM_DEF({name}, {arr})"  # MSMStrings.h format

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Mismari XOR Key Rotation Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("--obfuscation", metavar="0xNN",
                        help="مفتاح XOR الجديد لـ Obfuscation.h (مثال: 0xBE)")
    parser.add_argument("--antirevoke",  metavar="0xNN",
                        help="مفتاح XOR الجديد لـ MSMStrings.h  (مثال: 0x57)")
    parser.add_argument("--aes",         metavar="KEY16",
                        help="مفتاح AES-128 الجديد (16 حرف بالضبط)")
    args = parser.parse_args()

    if not any([args.obfuscation, args.antirevoke, args.aes]):
        parser.print_help()
        sys.exit(0)

    sep = "─" * 72

    # ── Obfuscation.h ──────────────────────────────────────────────────────
    if args.obfuscation:
        new_key = int(args.obfuscation, 16)
        print(f"\n{'═'*72}")
        print(f"  Obfuscation.h  |  OLD KEY=0x{CURRENT_OBF_KEY:02X}  →  NEW KEY=0x{new_key:02X}")
        print(f"{'═'*72}\n")
        print("/* ─── Strings ──────────────────────────────────────────────────── */")
        for name, text in OBFUSCATION_STRINGS:
            print(gen_string_defines(name, text, new_key))
        print()
        print("/* ─── JailBreak Paths ──────────────────────────────────────────── */")
        for idx, path_str in enumerate(JB_PATHS):
            print(gen_jb_path_define(idx, path_str, new_key))
        print()
        print(f"// Update _XK in Obfuscation.h to 0x{new_key:02X}")
        print(f"// ⚠️  Update _ENC_UPDATE_URL_V2 and _ENC_TELEMETRY_URL accordingly!")
        print()
        print(sep)
        print(f"خطوات ما بعد التدوير (Obfuscation.h):")
        print(f"  1. استبدل '#define _XK 0x{CURRENT_OBF_KEY:02X}' بـ '#define _XK 0x{new_key:02X}'")
        print(f"  2. انسخ التعريفات أعلاه وضعها في Obfuscation.h")
        print(f"  3. شغّل: cd dylib-sources/store-dylib && make")

    # ── MSMStrings.h ───────────────────────────────────────────────────────
    if args.antirevoke:
        new_key = int(args.antirevoke, 16)
        print(f"\n{'═'*72}")
        print(f"  MSMStrings.h   |  OLD KEY=0x{CURRENT_ARK_KEY:02X}  →  NEW KEY=0x{new_key:02X}")
        print(f"{'═'*72}\n")
        for name, text in ANTIREVOKE_STRINGS:
            print(gen_antirevoke_define(name, text, new_key))
        print()
        print(f"// Update MSM_KEY in MSMStrings.h to 0x{new_key:02X}")
        print()
        print(sep)
        print(f"خطوات ما بعد التدوير (MSMStrings.h):")
        print(f"  1. استبدل 'MSM_KEY 0x{CURRENT_ARK_KEY:02X}' بـ 'MSM_KEY 0x{new_key:02X}'")
        print(f"  2. انسخ MSM_DEF lines أعلاه إلى MSMStrings.h")
        print(f"  3. شغّل: cd dylib-src && make")

    # ── AES Key ────────────────────────────────────────────────────────────
    if args.aes:
        aes_key = args.aes
        if len(aes_key) != 16:
            print(f"❌  مفتاح AES يجب أن يكون 16 حرف بالضبط (أُعطي {len(aes_key)})", file=sys.stderr)
            sys.exit(1)
        obf_key = int(args.obfuscation, 16) if args.obfuscation else CURRENT_OBF_KEY
        print(f"\n{'═'*72}")
        print(f"  AES-128 Key  |  OLD={repr(CURRENT_AES_KEY)}  →  NEW={repr(aes_key)}")
        print(f"{'═'*72}\n")
        print("// في Obfuscation.h:")
        print(gen_aes_define(aes_key, obf_key))
        print()
        print("// في apps.ts (process.env.MSM_PAYLOAD_KEY):")
        print(f'//   MSM_PAYLOAD_KEY="{aes_key}"')
        print()
        print(sep)
        print("خطوات ما بعد تدوير مفتاح AES:")
        print(f"  1. حدّث _ENC_AESKEY في Obfuscation.h بالقيم أعلاه")
        print(f"  2. أضف MSM_PAYLOAD_KEY='{aes_key}' في متغيرات البيئة على السيرفر")
        print(f"  3. أعد بناء store-dylib وارفعه")

    print()

if __name__ == "__main__":
    main()
