#!/usr/bin/env python3
"""
Mismari Dylib — Key Rotation Tool  (بروتوكول الطوارئ)
=======================================================
يدوّر مفاتيح XOR في ملفات Obfuscation.h (KEY=0xAB) و MSMStrings.h (KEY=0x42)
ويُنتج تعريفات C الجديدة، وعند تمرير --deploy يرفع المفتاح الجديد للـ VPS تلقائياً.

الاستخدام:
  python3 rotate_keys.py --obfuscation 0xBE
  python3 rotate_keys.py --antirevoke  0x57
  python3 rotate_keys.py --aes "NewAES16ByteKey2"
  python3 rotate_keys.py --aes "NewAES16ByteKey2" --deploy
  python3 rotate_keys.py --obfuscation 0xBE --antirevoke 0x57 --aes "NewAES16ByteKey2" --deploy
"""

import argparse
import subprocess
import sys
import os
import re
import tempfile
import textwrap
from datetime import datetime

# ─── إعدادات VPS ──────────────────────────────────────────────────────────────
VPS_HOST      = "45.67.216.177"
VPS_USER      = "root"
VPS_PORT      = 22
VPS_ENV_FILE  = "/opt/mismari/.env"          # ملف .env في السيرفر
VPS_PM2_PROC  = "mismari-api"                # اسم عملية PM2
# مفتاح SSH الذي يستخدمه الجهاز (اضبطه إذا لم يكن الـ default):
SSH_KEY_PATH  = os.path.expanduser("~/.ssh/id_rsa")

# ─── المفاتيح الحالية ─────────────────────────────────────────────────────────
CURRENT_OBF_KEY = 0xAB   # Obfuscation.h  (store-dylib)
CURRENT_ARK_KEY = 0x42   # MSMStrings.h   (antirevoke)
CURRENT_AES_KEY = "Msm@Store#2026!K"

# ─── قوائم النصوص المشفّرة ────────────────────────────────────────────────────
OBFUSCATION_STRINGS = [
    # Bundle & URLs
    ("_ENC_BUNDLE_ID",     "com.mismari.app"),
    ("_ENC_UPDATE_URL",    "https://app.mismari.com/api/settings"),
    ("_ENC_UPDATE_URL_V2", "https://app.mismari.com/api/v2/dylib/settings"),
    ("_ENC_TELEMETRY_URL", "https://app.mismari.com/api/v2/telemetry/proxy"),
    ("_ENC_BASE_URL",      "https://app.mismari.com"),
    # Update / Version keys
    ("_ENC_UPDATE_KEY",    "storeVersion"),
    ("_ENC_STORE_NOTES",   "releaseNotes"),
    ("_ENC_CF_VERSION",    "CFBundleShortVersionString"),
    # Safe-Mode keys
    ("_ENC_CRASH_KEY",     "MSMCrashCount"),
    ("_ENC_LASTRUN_KEY",   "MSMLastRunSuccess"),
    ("_ENC_WELCOME_KEY",   "MSMWelcomedVersion"),
    # Smart Proxy keys
    ("_ENC_HTTP_ENABLE",   "HTTPEnable"),
    ("_ENC_HTTPS_ENABLE",  "HTTPSEnable"),
    ("_ENC_HTTP_PROXY",    "HTTPProxy"),
    ("_ENC_HTTPS_PROXY",   "HTTPSProxy"),
    ("_ENC_HTTP_PORT",     "HTTPPort"),
    ("_ENC_HTTPS_PORT",    "HTTPSPort"),
    ("_ENC_LOOPBACK",      "127.0.0.1"),
    ("_ENC_LOCALHOST",     "localhost"),
    ("_ENC_PROXY_KEY",     "MSStoreProxyBlock"),
    # AES payload JSON keys
    ("_ENC_MSM_ENC",       "msm_enc"),
    ("_ENC_MSM_IV",        "msm_iv"),
]

# مسارات JailBreak (EP0-EP28)
JB_PATHS = [
    "/Library/MobileSubstrate/",
    "/Library/MobileSubstrate/DynamicLibraries/",
    "/var/lib/cydia/",
    "/var/lib/dpkg/info/",
    "/usr/libexec/cydia/",
    "/usr/lib/libsubstitute.dylib",
    "/usr/lib/substrate/",
    "/usr/lib/tweaks/",
    "/var/mobile/Applications/",
    "/var/stash/",
    "/var/checkra1n.dmg",
    "/usr/bin/cycript",
    "/usr/local/bin/cycript",
    "/usr/sbin/frida-server",
    "/etc/apt/",
    "/bin/bash",
    "/usr/bin/sshd",
    "/usr/sbin/sshd",
    "/etc/ssh/sshd_config",
    "/Applications/Cydia.app",
    "/Applications/Sileo.app",
    "/Applications/Zebra.app",
    "/Applications/Filza.app",
    "/bin/sh",
    "/private/preboot/",        # EP24 — Rootless
    "/var/jb/",                 # EP25 — Rootless base
    "/var/jb/usr/",             # EP26 — Rootless binaries
    "/var/jb/Library/",         # EP27 — Rootless tweaks
    "/.file",                   # EP28 — Dopamine marker
]

ANTIREVOKE_STRINGS = [
    ("S_OCSP_APPLE",     "ocsp.apple.com"),
    ("S_OCSP_APPLE2",    "ocsp2.apple.com"),
    ("S_CRL_APPLE",      "crl.apple.com"),
    ("S_VALID_APPLE",    "valid.apple.com"),
    ("S_OCSP_PATH",      "/ocsp"),
    ("S_CRL_PATH",       "/crl"),
    ("S_CERT_PATH",      "/cert"),
    ("S_IDFV_KEY",       "__msm_idfv__"),
    ("S_ENV_DYLD",       "DYLD_INSERT_LIBRARIES"),
    ("S_ENV_XCTEST",     "_XCAppTest"),
    ("S_ENV_SUBSTRATE",  "MobileSubstrate"),
    ("S_ENV_SUBSTITUTE", "Substitute"),
    ("S_ENV_SAFEMODE",   "_MSSafeMode"),
    ("S_ENV_LIBHOOKER",  "LIBHOOKER"),
    ("S_ENV_INJECTION",  "INJECTION_BUNDLE"),
    ("S_ENV_FRIDA",      "frida"),
    ("S_ENV_FRIDA_SRV",  "FRIDA_SERVER"),
    ("S_ENV_FRIDA_GAD",  "FRIDA_GADGET"),
]

# ─── Helpers ──────────────────────────────────────────────────────────────────

def xor_encode(text: str, key: int) -> list[int]:
    return [ord(c) ^ key for c in text]

def fmt_arr(encoded: list[int], null_term: bool = True) -> str:
    data = encoded + ([0x00] if null_term else [])
    return "{" + ",".join(f"0x{b:02X}" for b in data) + "}"

def gen_str_define(name: str, text: str, key: int) -> str:
    arr = fmt_arr(xor_encode(text, key))
    lname = re.sub(r"_ENC_", "_LEN_", name)
    return f"#define {name:<26} {arr}\n#define {lname:<26} {len(text)+1}"

def gen_jb_define(idx: int, path: str, key: int) -> str:
    arr = fmt_arr(xor_encode(path, key))
    return f"/* {path!r} */\n#define _EP{idx} {arr}\n#define _LP{idx} {len(path)+1}"

def gen_aes_define(aes_text: str, xor_key: int) -> str:
    arr = fmt_arr(xor_encode(aes_text, xor_key), null_term=False)
    return (f"/* AES-128 key: {aes_text!r} */\n"
            f"#define _ENC_AESKEY  {arr}\n"
            f"#define _LEN_AESKEY  {len(aes_text)}")

def gen_ark_define(name: str, text: str, key: int) -> str:
    arr = fmt_arr(xor_encode(text, key))
    return f"MSM_DEF({name}, {arr})"

SEP = "─" * 72
EQ  = "═" * 72

# ─── SSH Deploy ───────────────────────────────────────────────────────────────

def ssh_run(cmd: str, password: str | None = None) -> tuple[int, str, str]:
    """يُنفّذ أمر SSH ويُعيد (returncode, stdout, stderr)."""
    ssh_base = [
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=10",
        "-p", str(VPS_PORT),
    ]
    if os.path.isfile(SSH_KEY_PATH):
        ssh_base += ["-i", SSH_KEY_PATH]

    full_cmd = ssh_base + [f"{VPS_USER}@{VPS_HOST}", cmd]
    result = subprocess.run(full_cmd, capture_output=True, text=True, timeout=30)
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def deploy_aes_key(new_aes: str, ssh_password: str | None = None) -> bool:
    """
    يحدّث MSM_PAYLOAD_KEY في ملف .env على الـ VPS ثم يعيد تشغيل PM2.
    يستخدم SSH key authentication أو password (إذا مُرّر --ssh-password).
    """
    print(f"\n{'━'*72}")
    print(f"  🔐 SSH Deploy  →  {VPS_USER}@{VPS_HOST}:{VPS_PORT}")
    print(f"{'━'*72}")

    # ① اختبار الاتصال
    print("  ① اختبار الاتصال...", end=" ", flush=True)
    rc, out, err = ssh_run("echo OK")
    if rc != 0 or out != "OK":
        print(f"❌ فشل!\n     {err or 'لا يوجد رد'}")
        print("\n  تلميح: تأكد من وجود SSH key في ~/.ssh/id_rsa أو مرّر --ssh-password")
        return False
    print("✓")

    # ② قراءة الـ .env الحالي
    print(f"  ② قراءة {VPS_ENV_FILE}...", end=" ", flush=True)
    rc, env_content, err = ssh_run(f"cat {VPS_ENV_FILE} 2>/dev/null || echo '__EMPTY__'")
    if rc != 0:
        print(f"❌  {err}")
        return False
    print("✓")

    # ③ تحديث أو إضافة MSM_PAYLOAD_KEY
    print(f"  ③ تحديث MSM_PAYLOAD_KEY...", end=" ", flush=True)
    key_line = f"MSM_PAYLOAD_KEY={new_aes}"

    if env_content == "__EMPTY__":
        new_env = key_line
    elif "MSM_PAYLOAD_KEY=" in env_content:
        # استبدل السطر الموجود
        new_env = re.sub(
            r"^MSM_PAYLOAD_KEY=.*$",
            key_line,
            env_content,
            flags=re.MULTILINE
        )
    else:
        # أضفه في نهاية الملف
        new_env = env_content.rstrip("\n") + "\n" + key_line

    # ارفع الـ .env المحدَّث عبر heredoc
    escaped = new_env.replace("'", "'\\''")
    rc, _, err = ssh_run(f"printf '%s' '{escaped}' > {VPS_ENV_FILE}")
    if rc != 0:
        print(f"❌  {err}")
        return False
    print("✓")

    # ④ تحقق من الكتابة
    print(f"  ④ تحقق من الكتابة...", end=" ", flush=True)
    rc, verify, _ = ssh_run(f"grep MSM_PAYLOAD_KEY {VPS_ENV_FILE}")
    if new_aes not in verify:
        print("❌ القيمة لم تُكتب بشكل صحيح!")
        return False
    print("✓")

    # ⑤ إعادة تشغيل PM2
    print(f"  ⑤ إعادة تشغيل {VPS_PM2_PROC}...", end=" ", flush=True)
    rc, out, err = ssh_run(f"pm2 restart {VPS_PM2_PROC} --update-env 2>&1")
    if rc != 0:
        print(f"⚠️  {err or out}")
        print("     PM2 قد لا يكون مثبتاً أو اسم العملية مختلف. أعد التشغيل يدوياً.")
    else:
        print("✓")

    # ⑥ تأكيد نهائي
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n  ✅ تم الـ Deploy بنجاح [{ts}]")
    print(f"     السيرفر الآن يستخدم: MSM_PAYLOAD_KEY={new_aes[:4]}{'*'*12}")
    print(f"\n  ⚠️  لا تنسَ: أعد بناء store-dylib وانشره (الدايلب يحمل المفتاح المشفَّر)")
    return True


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Mismari Key Rotation Tool — بروتوكول الطوارئ",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(__doc__ or "")
    )
    parser.add_argument("--obfuscation",  metavar="0xNN",
                        help="مفتاح XOR جديد لـ Obfuscation.h (مثال: 0xBE)")
    parser.add_argument("--antirevoke",   metavar="0xNN",
                        help="مفتاح XOR جديد لـ MSMStrings.h  (مثال: 0x57)")
    parser.add_argument("--aes",          metavar="KEY16",
                        help="مفتاح AES-128 جديد (16 حرف بالضبط)")
    parser.add_argument("--deploy",       action="store_true",
                        help="ارفع مفتاح AES الجديد للـ VPS تلقائياً عبر SSH")
    parser.add_argument("--ssh-password", metavar="PASS",
                        help="كلمة مرور SSH (اختياري إذا عندك SSH key مُعدَّ)")
    parser.add_argument("--vps-host",     metavar="IP",
                        help=f"عنوان VPS (الافتراضي: {VPS_HOST})")
    parser.add_argument("--vps-env",      metavar="PATH",
                        help=f"مسار .env في VPS (الافتراضي: {VPS_ENV_FILE})")
    args = parser.parse_args()

    if not any([args.obfuscation, args.antirevoke, args.aes]):
        parser.print_help()
        sys.exit(0)

    # تجاوز قيم VPS إذا مُرّرت
    global VPS_HOST, VPS_ENV_FILE
    if args.vps_host:  VPS_HOST    = args.vps_host
    if args.vps_env:   VPS_ENV_FILE = args.vps_env

    # ── Obfuscation.h ──────────────────────────────────────────────────────
    if args.obfuscation:
        new_key = int(args.obfuscation, 16)
        print(f"\n{EQ}")
        print(f"  Obfuscation.h   OLD KEY=0x{CURRENT_OBF_KEY:02X}  →  NEW KEY=0x{new_key:02X}")
        print(f"{EQ}\n")
        print("/* ─── Strings ───────────────────────────────────────────── */")
        for name, text in OBFUSCATION_STRINGS:
            print(gen_str_define(name, text, new_key))
        print()
        print("/* ─── JailBreak Paths ───────────────────────────────────── */")
        for idx, p in enumerate(JB_PATHS):
            print(gen_jb_define(idx, p, new_key))
        print()

        if args.aes:
            print(gen_aes_define(args.aes, new_key))
            print()

        print(SEP)
        print(f"خطوات Obfuscation.h:")
        print(f"  1. '#define _XK 0x{CURRENT_OBF_KEY:02X}' → '#define _XK 0x{new_key:02X}'")
        print(f"  2. انسخ التعريفات أعلاه إلى Obfuscation.h")
        print(f"  3. cd dylib-sources/store-dylib && make")

    # ── MSMStrings.h ───────────────────────────────────────────────────────
    if args.antirevoke:
        new_key = int(args.antirevoke, 16)
        print(f"\n{EQ}")
        print(f"  MSMStrings.h    OLD KEY=0x{CURRENT_ARK_KEY:02X}  →  NEW KEY=0x{new_key:02X}")
        print(f"{EQ}\n")
        for name, text in ANTIREVOKE_STRINGS:
            print(gen_ark_define(name, text, new_key))
        print()
        print(SEP)
        print(f"خطوات MSMStrings.h:")
        print(f"  1. 'MSM_KEY 0x{CURRENT_ARK_KEY:02X}' → 'MSM_KEY 0x{new_key:02X}'")
        print(f"  2. انسخ MSM_DEF lines أعلاه إلى MSMStrings.h")
        print(f"  3. cd dylib-src && make")

    # ── AES Key ────────────────────────────────────────────────────────────
    if args.aes and not args.obfuscation:
        aes_key = args.aes
        if len(aes_key) != 16:
            print(f"❌  مفتاح AES يجب 16 حرف (أُعطي {len(aes_key)})", file=sys.stderr)
            sys.exit(1)
        obf_xor = CURRENT_OBF_KEY
        print(f"\n{EQ}")
        print(f"  AES Key   OLD={CURRENT_AES_KEY!r}  →  NEW={aes_key!r}")
        print(f"{EQ}\n")
        print("// في Obfuscation.h:")
        print(gen_aes_define(aes_key, obf_xor))
        print()
        print(f"// في السيرفر .env:")
        print(f'// MSM_PAYLOAD_KEY="{aes_key}"')
        print()
        print(SEP)
        print("خطوات AES key:")
        print(f"  1. حدّث _ENC_AESKEY في Obfuscation.h بالقيم أعلاه")
        print(f"  2. MSM_PAYLOAD_KEY='{aes_key}' في .env السيرفر")
        print(f"  3. أعد بناء store-dylib")

    # ── SSH Deploy ─────────────────────────────────────────────────────────
    if args.deploy:
        if not args.aes:
            print("\n❌  --deploy يتطلب --aes لمعرفة المفتاح الجديد", file=sys.stderr)
            sys.exit(1)
        deploy_aes_key(args.aes, args.ssh_password)

    print()

if __name__ == "__main__":
    main()
