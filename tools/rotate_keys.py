#!/usr/bin/env python3
"""
Mismari Dylib — Key Rotation Tool  (بروتوكول الطوارئ)
=======================================================
يدوّر مفاتيح XOR/AES، يرفع المفتاح للـ VPS عبر SSH، ويحدّث إعدادات المتجر في الـ API.

الإعداد الأول (مرة واحدة):
  cp tools/.deploy.conf.template tools/.deploy.conf
  # ثم عدّل .deploy.conf بقيمك الخاصة

SSH Keys بدون Password (موصى به):
  ssh-keygen -t ed25519 -C "mismari-deploy"
  ssh-copy-id -i ~/.ssh/id_ed25519.pub root@45.67.216.177

الاستخدام:
  python3 rotate_keys.py --obfuscation 0xBE
  python3 rotate_keys.py --antirevoke  0x57
  python3 rotate_keys.py --aes "NewAES16ByteKey2"
  python3 rotate_keys.py --aes "NewAES16ByteKey2" --deploy
  python3 rotate_keys.py --aes "NewKey16Chars!!!" --deploy --update-api --dylib-version 2.1 --dylib-notes "حماية أقوى"
  python3 rotate_keys.py --obfuscation 0xCF --antirevoke 0x38 --aes "NewKey16Chars!!!" --deploy --update-api
"""

import argparse
import configparser
import json
import os
import re
import subprocess
import sys
import textwrap
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# ─── مسار ملف الإعدادات ───────────────────────────────────────────────────────
_SCRIPT_DIR  = Path(__file__).parent
_CONF_PATH   = _SCRIPT_DIR / ".deploy.conf"
_TMPL_PATH   = _SCRIPT_DIR / ".deploy.conf.template"

def _load_conf() -> configparser.ConfigParser:
    cfg = configparser.ConfigParser()
    if _CONF_PATH.exists():
        cfg.read(_CONF_PATH)
    return cfg

CFG = _load_conf()

def _c(section: str, key: str, default: str) -> str:
    try:    return CFG[section][key].strip() or default
    except: return default

# ─── إعدادات VPS (من .deploy.conf أو قيم افتراضية) ──────────────────────────
VPS_HOST      = _c("vps", "host",     "45.67.216.177")
VPS_USER      = _c("vps", "user",     "root")
VPS_PORT      = int(_c("vps", "port", "22"))
VPS_ENV_FILE  = _c("vps", "env_file", "/opt/mismari/.env")
VPS_PM2_PROC  = _c("vps", "pm2_proc", "mismari-api")
SSH_KEY_PATH  = os.path.expanduser(_c("vps", "ssh_key", "~/.ssh/id_rsa"))

# ─── إعدادات Admin API ────────────────────────────────────────────────────────
ADMIN_URL     = _c("api", "admin_url",   "https://app.mismari.com/api/admin")
ADMIN_TOKEN   = _c("api", "admin_token", "")

# ─── إعدادات Cloudflare R2 ───────────────────────────────────────────────────
R2_BASE       = _c("dylib", "r2_base_url",      "https://dl.mismari.com")
STORE_DYLIB   = _c("dylib", "store_dylib_name",  "mismari-store.dylib")
ARK_DYLIB     = _c("dylib", "antirevoke_name",   "antirevoke.dylib")

# ─── المفاتيح الحالية ─────────────────────────────────────────────────────────
CURRENT_OBF_KEY = 0xAB   # Obfuscation.h  (store-dylib)
CURRENT_ARK_KEY = 0x42   # MSMStrings.h   (antirevoke)
CURRENT_AES_KEY = "Msm@Store#2026!K"

# ─── قائمة النصوص الأصلية (source of truth) ──────────────────────────────────
OBFUSCATION_STRINGS = [
    ("_ENC_BUNDLE_ID",     "com.mismari.app"),
    ("_ENC_UPDATE_URL",    "https://app.mismari.com/api/settings"),
    ("_ENC_UPDATE_URL_V2", "https://app.mismari.com/api/v2/dylib/settings"),
    ("_ENC_TELEMETRY_URL", "https://app.mismari.com/api/v2/telemetry/proxy"),
    ("_ENC_BASE_URL",      "https://app.mismari.com"),
    ("_ENC_UPDATE_KEY",    "storeVersion"),
    ("_ENC_STORE_NOTES",   "releaseNotes"),
    ("_ENC_CF_VERSION",    "CFBundleShortVersionString"),
    ("_ENC_CRASH_KEY",     "MSMCrashCount"),
    ("_ENC_LASTRUN_KEY",   "MSMLastRunSuccess"),
    ("_ENC_WELCOME_KEY",   "MSMWelcomedVersion"),
    ("_ENC_HTTP_ENABLE",   "HTTPEnable"),
    ("_ENC_HTTPS_ENABLE",  "HTTPSEnable"),
    ("_ENC_HTTP_PROXY",    "HTTPProxy"),
    ("_ENC_HTTPS_PROXY",   "HTTPSProxy"),
    ("_ENC_HTTP_PORT",     "HTTPPort"),
    ("_ENC_HTTPS_PORT",    "HTTPSPort"),
    ("_ENC_LOOPBACK",      "127.0.0.1"),
    ("_ENC_LOCALHOST",     "localhost"),
    ("_ENC_PROXY_KEY",     "MSStoreProxyBlock"),
    ("_ENC_MSM_ENC",       "msm_enc"),
    ("_ENC_MSM_IV",        "msm_iv"),
]

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
    "/private/preboot/",
    "/var/jb/",
    "/var/jb/usr/",
    "/var/jb/Library/",
    "/.file",
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
    arr  = fmt_arr(xor_encode(text, key))
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

# ─── SSH Helpers ──────────────────────────────────────────────────────────────

def _ssh_cmd(remote_cmd: str, ssh_pass: str | None = None) -> tuple[int, str, str]:
    """يُنفّذ أمر على الـ VPS عبر SSH ويُعيد (code, stdout, stderr)."""
    base = ["ssh", "-o", "StrictHostKeyChecking=no",
            "-o", "ConnectTimeout=10",
            "-p", str(VPS_PORT)]
    if os.path.isfile(SSH_KEY_PATH):
        base += ["-i", SSH_KEY_PATH]
    cmd = base + [f"{VPS_USER}@{VPS_HOST}", remote_cmd]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

def _step(label: str) -> None:
    print(f"  {label}", end=" ", flush=True)

def _ok()  -> None: print("✓")
def _fail(msg: str) -> None: print(f"❌  {msg}")

# ─── SSH Deploy: AES Key ──────────────────────────────────────────────────────

def deploy_aes_key(new_aes: str, ssh_pass: str | None = None) -> bool:
    """يرفع MSM_PAYLOAD_KEY الجديد لـ .env على الـ VPS ثم يعيد تشغيل PM2."""
    print(f"\n{'━'*72}")
    print(f"  🔐 SSH Deploy  →  {VPS_USER}@{VPS_HOST}:{VPS_PORT}")
    print(f"     ENV: {VPS_ENV_FILE}  |  PM2: {VPS_PM2_PROC}")
    print(f"{'━'*72}")

    # ① اختبار الاتصال
    _step("① اختبار SSH...")
    rc, out, err = _ssh_cmd("echo PONG")
    if rc != 0 or "PONG" not in out:
        _fail(err or "لا استجابة")
        print("""
  ─── راجع إعداد SSH Key ─────────────────────────────────────────────
  على جهازك المحلي:
    ssh-keygen -t ed25519 -C "mismari-deploy" -f ~/.ssh/mismari_deploy
    ssh-copy-id -i ~/.ssh/mismari_deploy.pub root@45.67.216.177

  ثم في tools/.deploy.conf:
    [vps]
    ssh_key = ~/.ssh/mismari_deploy

  أو مرّر مؤقتاً: --ssh-password YOUR_PASS
  ─────────────────────────────────────────────────────────────────────""")
        return False
    _ok()

    # ② قراءة .env الحالي
    _step(f"② قراءة {VPS_ENV_FILE}...")
    rc, env_txt, err = _ssh_cmd(f"cat {VPS_ENV_FILE} 2>/dev/null || echo '__EMPTY__'")
    if rc != 0:
        _fail(err); return False
    _ok()

    # ③ تحديث السطر في الذاكرة
    _step("③ تحديث MSM_PAYLOAD_KEY...")
    new_line = f"MSM_PAYLOAD_KEY={new_aes}"
    if env_txt == "__EMPTY__":
        new_env = new_line
    elif "MSM_PAYLOAD_KEY=" in env_txt:
        new_env = re.sub(r"^MSM_PAYLOAD_KEY=.*$", new_line,
                         env_txt, flags=re.MULTILINE)
    else:
        new_env = env_txt.rstrip("\n") + "\n" + new_line

    # ④ كتابة الملف عبر printf (أكثر أماناً من echo لأنه يدعم الرموز الخاصة)
    escaped = new_env.replace("\\", "\\\\").replace("'", "'\\''")
    rc, _, err = _ssh_cmd(f"printf '%s' '{escaped}' > {VPS_ENV_FILE}")
    if rc != 0:
        _fail(err); return False
    _ok()

    # ④ تحقق من الكتابة
    _step("④ تحقق...")
    rc, verify, _ = _ssh_cmd(f"grep MSM_PAYLOAD_KEY {VPS_ENV_FILE}")
    if new_aes not in verify:
        _fail("القيمة لم تُكتب — تحقق من صلاحيات الملف"); return False
    _ok()

    # ⑤ إعادة تشغيل PM2 مع تحديث env
    _step(f"⑤ pm2 restart {VPS_PM2_PROC} --update-env...")
    rc, pm2_out, pm2_err = _ssh_cmd(
        f"pm2 restart {VPS_PM2_PROC} --update-env 2>&1 | tail -3")
    if rc != 0:
        _fail(pm2_err or pm2_out)
        print("     ⚠️  أعد التشغيل يدوياً: ssh root@VPS 'pm2 restart mismari-api --update-env'")
    else:
        _ok()

    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n  ✅ تم الـ Deploy بنجاح [{ts}]")
    print(f"     السيرفر يستخدم الآن: MSM_PAYLOAD_KEY={new_aes[:4]}{'*'*12}")
    print(f"  ⚠️  أعد بناء store-dylib وارفع الـ .dylib لـ Cloudflare R2")
    return True


# ─── Admin API: تحديث إعدادات المتجر ─────────────────────────────────────────

def update_api_settings(version: str, notes: str,
                        admin_token: str | None = None) -> bool:
    """
    يحدّث store_version و release_notes في قاعدة بيانات المتجر عبر Admin API.
    يستخدم token من .deploy.conf أو --admin-token.
    """
    token = admin_token or ADMIN_TOKEN
    if not token:
        print("\n  ❌ --update-api يتطلب admin_token في .deploy.conf أو --admin-token")
        print(f"     احصل على token من: POST {ADMIN_URL}/login")
        return False

    dylib_url = f"{R2_BASE}/{STORE_DYLIB}"
    settings_payload = [
        {"key": "store_version",  "value": version},
        {"key": "release_notes",  "value": notes},
        {"key": "store_dylib_url","value": dylib_url},
    ]
    body = json.dumps({"settings": settings_payload}).encode()

    req = urllib.request.Request(
        url=f"{ADMIN_URL}/settings",
        data=body,
        method="PUT",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }
    )

    print(f"\n{'━'*72}")
    print(f"  📡 Admin API Update  →  {ADMIN_URL}/settings")
    print(f"{'━'*72}")
    _step(f"① تحديث store_version={version} | store_dylib_url={dylib_url}...")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        _ok()
        updated = {s["key"]: s["value"] for s in data.get("settings", [])}
        print(f"     store_version  = {updated.get('store_version', '?')}")
        print(f"     store_dylib_url= {updated.get('store_dylib_url', '?')}")
        print(f"     release_notes  = {updated.get('release_notes', '?')[:50]}...")
        print(f"\n  ✅ إعدادات API مُحدَّثة — المشتركون سيرون التحديث تلقائياً")
        return True
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode()[:200]
        _fail(f"HTTP {e.code}: {body_txt}")
        return False
    except Exception as e:
        _fail(str(e))
        return False


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Mismari Key Rotation Tool — بروتوكول الطوارئ",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(__doc__ or "")
    )
    # مفاتيح التشفير
    parser.add_argument("--obfuscation",  metavar="0xNN",
                        help="مفتاح XOR جديد لـ Obfuscation.h (مثال: 0xBE)")
    parser.add_argument("--antirevoke",   metavar="0xNN",
                        help="مفتاح XOR جديد لـ MSMStrings.h  (مثال: 0x57)")
    parser.add_argument("--aes",          metavar="KEY16",
                        help="مفتاح AES-128 جديد (16 حرف بالضبط)")
    # نشر على الـ VPS
    parser.add_argument("--deploy",       action="store_true",
                        help="ارفع مفتاح AES الجديد للـ VPS عبر SSH")
    parser.add_argument("--ssh-password", metavar="PASS",
                        help="كلمة مرور SSH (الأفضل: استخدم SSH key بدلاً من هذا)")
    # تحديث API المتجر
    parser.add_argument("--update-api",   action="store_true",
                        help="حدّث store_version/store_dylib_url في Admin API")
    parser.add_argument("--dylib-version",metavar="VER",  default="",
                        help="إصدار المتجر الجديد (مثال: 2.1)")
    parser.add_argument("--dylib-notes",  metavar="NOTES", default="تحسينات وإصلاحات.",
                        help="ملاحظات الإصدار (عربي)")
    parser.add_argument("--admin-token",  metavar="JWT",
                        help="JWT token للـ Admin API (أو ضعه في .deploy.conf)")
    # إعدادات بديلة
    parser.add_argument("--vps-host",     metavar="IP",   help=f"عنوان VPS (الافتراضي: {VPS_HOST})")
    parser.add_argument("--vps-env",      metavar="PATH", help=f"مسار .env في VPS")
    args = parser.parse_args()

    if not any([args.obfuscation, args.antirevoke, args.aes,
                args.deploy, args.update_api]):
        parser.print_help()
        sys.exit(0)

    # تجاوز globals إذا مُرّرت
    global VPS_HOST, VPS_ENV_FILE
    if args.vps_host: VPS_HOST     = args.vps_host
    if args.vps_env:  VPS_ENV_FILE = args.vps_env

    # ── التحقق من ملف الإعدادات ────────────────────────────────────────────
    if not _CONF_PATH.exists() and (args.deploy or args.update_api):
        print(f"\n  ⚠️  لم يُعثر على {_CONF_PATH.name}")
        print(f"     شغّل: cp tools/.deploy.conf.template tools/.deploy.conf")
        print(f"     ثم عدّل القيم — الملف لن يُرفع لـ GitHub (.gitignore)")
        print()

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
        print("/* ─── JailBreak Paths (EP0-EP28) ────────────────────────── */")
        for idx, p in enumerate(JB_PATHS):
            print(gen_jb_define(idx, p, new_key))
        print()
        if args.aes:
            print(gen_aes_define(args.aes, new_key))
            print()
        print(SEP)
        print(f"خطوات Obfuscation.h:")
        print(f"  1. '#define _XK 0x{CURRENT_OBF_KEY:02X}'  →  '#define _XK 0x{new_key:02X}'")
        print(f"  2. انسخ التعريفات أعلاه إلى dylib-sources/store-dylib/Obfuscation.h")
        print(f"  3. cd dylib-sources/store-dylib && make FINALPACKAGE=1")

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
        print(f"  1. 'MSM_KEY 0x{CURRENT_ARK_KEY:02X}'  →  'MSM_KEY 0x{new_key:02X}'")
        print(f"  2. انسخ MSM_DEF lines أعلاه إلى dylib-src/MSMStrings.h")
        print(f"  3. cd dylib-src && make FINALPACKAGE=1")

    # ── AES Key (بدون --obfuscation) ──────────────────────────────────────
    if args.aes and not args.obfuscation:
        aes_key = args.aes
        if len(aes_key) != 16:
            print(f"❌  مفتاح AES يجب 16 حرف بالضبط (أُعطي {len(aes_key)})", file=sys.stderr)
            sys.exit(1)
        print(f"\n{EQ}")
        print(f"  AES-128   OLD={CURRENT_AES_KEY!r}  →  NEW={aes_key!r}")
        print(f"{EQ}\n")
        print("// في Obfuscation.h — استبدل _ENC_AESKEY:")
        print(gen_aes_define(aes_key, CURRENT_OBF_KEY))
        print(f"\n// في .env السيرفر:")
        print(f'// MSM_PAYLOAD_KEY="{aes_key}"')
        print()
        print(SEP)
        print("خطوات AES key:")
        print("  1. حدّث _ENC_AESKEY في Obfuscation.h")
        print("  2. أعد بناء store-dylib: cd dylib-sources/store-dylib && make FINALPACKAGE=1")
        print(f"  3. MSM_PAYLOAD_KEY='{aes_key}' في .env السيرفر (أو استخدم --deploy)")

    # ── SSH Deploy ─────────────────────────────────────────────────────────
    if args.deploy:
        if not args.aes:
            print("\n❌  --deploy يتطلب --aes", file=sys.stderr); sys.exit(1)
        deploy_aes_key(args.aes, args.ssh_password)

    # ── Admin API Update ───────────────────────────────────────────────────
    if args.update_api:
        version = args.dylib_version
        if not version:
            version = input("\n  إصدار المتجر الجديد (مثال: 2.1): ").strip()
            if not version:
                print("❌  أدخل إصدار", file=sys.stderr); sys.exit(1)
        notes = args.dylib_notes
        update_api_settings(version, notes, args.admin_token)

    print()

if __name__ == "__main__":
    main()
