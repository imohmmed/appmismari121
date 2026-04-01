#!/usr/bin/env python3
"""
Mismari Dylib — Key Rotation & Deployment Tool  (بروتوكول الطوارئ الكامل)
===========================================================================
يدوّر مفاتيح XOR/AES، يبني الدايلبين، يرفعهم لـ R2، ويحدّث الـ VPS و API.

الإعداد الأول (مرة واحدة):
  cp tools/.deploy.conf.template tools/.deploy.conf
  # عدّل .deploy.conf بقيمك الحقيقية

SSH Keys (موصى به بدلاً من Password):
  ssh-keygen -t ed25519 -C "mismari-deploy" -f ~/.ssh/mismari_deploy
  ssh-copy-id -i ~/.ssh/mismari_deploy.pub root@VPS_IP

Cloudflare R2 (للرفع التلقائي):
  npm install -g wrangler
  wrangler login   ← أو ضع CLOUDFLARE_API_TOKEN في .deploy.conf

أمثلة الاستخدام:
  # طوارئ كاملة — دوّر + ابنِ + ارفع + حدّث API:
  python3 rotate_keys.py --obfuscation 0xCF --antirevoke 0x38 \\
    --aes "MsmSecure2027!XY" --deploy --build --upload-r2 \\
    --update-api --dylib-version 3.0 --dylib-notes "تحديث أمني"

  # دوّر المفاتيح فقط (ابنِ يدوياً):
  python3 rotate_keys.py --obfuscation 0xBE --antirevoke 0x57

  # رفع AES جديد للسيرفر فقط:
  python3 rotate_keys.py --aes "Msm@Store#2027!V" --deploy

  # تحديث API بعد رفع ملف يدوياً:
  python3 rotate_keys.py --update-api --dylib-version 2.5 --dylib-notes "..."
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
_SCRIPT_DIR = Path(__file__).parent
_CONF_PATH  = _SCRIPT_DIR / ".deploy.conf"
_REPO_ROOT  = _SCRIPT_DIR.parent

def _load_conf() -> configparser.ConfigParser:
    cfg = configparser.ConfigParser()
    if _CONF_PATH.exists():
        cfg.read(_CONF_PATH)
    return cfg

CFG = _load_conf()

def _c(section: str, key: str, default: str = "") -> str:
    try:    return CFG[section][key].strip() or default
    except: return default

# ─── إعدادات من .deploy.conf ─────────────────────────────────────────────────
VPS_HOST      = _c("vps", "host",       "45.67.216.177")
VPS_USER      = _c("vps", "user",       "root")
VPS_PORT      = int(_c("vps", "port",   "22"))
VPS_ENV_FILE  = _c("vps", "env_file",   "/opt/mismari/.env")
VPS_PM2_PROC  = _c("vps", "pm2_proc",  "mismari-api")
SSH_KEY_PATH  = os.path.expanduser(_c("vps", "ssh_key", "~/.ssh/id_rsa"))

ADMIN_URL     = _c("api", "admin_url",   "https://app.mismari.com/api/admin")
ADMIN_TOKEN   = _c("api", "admin_token", "")

R2_BASE       = _c("dylib", "r2_base_url",       "https://dl.mismari.com")
STORE_DYLIB   = _c("dylib", "store_dylib_name",   "mismari-store.dylib")
ARK_DYLIB     = _c("dylib", "antirevoke_name",    "antirevoke.dylib")

CF_API_TOKEN  = _c("cloudflare", "api_token",     "")
CF_ACCOUNT_ID = _c("cloudflare", "account_id",    "")
R2_BUCKET     = _c("cloudflare", "r2_bucket",     "mismari-dylib")

STORE_DYLIB_SRC = _REPO_ROOT / "dylib-sources" / "store-dylib" / "mismari-store.dylib"
ARK_DYLIB_SRC   = _REPO_ROOT / "dylib-src"              / "antirevoke.dylib"
STORE_MAKE_DIR  = _REPO_ROOT / "dylib-sources" / "store-dylib"
ARK_MAKE_DIR    = _REPO_ROOT / "dylib-src"

# ─── المفاتيح الحالية ─────────────────────────────────────────────────────────
CURRENT_OBF_KEY = 0xAB
CURRENT_ARK_KEY = 0x42
CURRENT_AES_KEY = "Msm@Store#2026!K"

# ─── قوائم النصوص ─────────────────────────────────────────────────────────────
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
SEP = "─" * 72
EQ  = "═" * 72

def xor_encode(text: str, key: int) -> list[int]:
    return [ord(c) ^ key for c in text]

def fmt_arr(encoded: list[int], null_term: bool = True) -> str:
    data = encoded + ([0x00] if null_term else [])
    return "{" + ",".join(f"0x{b:02X}" for b in data) + "}"

def gen_str_define(name: str, text: str, key: int) -> str:
    arr   = fmt_arr(xor_encode(text, key))
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
    return f"MSM_DEF({name}, {fmt_arr(xor_encode(text, key))})"

def _step(label: str) -> None:
    print(f"  {label}", end=" ", flush=True)

def _ok()            -> None: print("✓")
def _fail(msg: str)  -> None: print(f"❌  {msg}")
def _warn(msg: str)  -> None: print(f"  ⚠️  {msg}")

# ─── SSH Helpers ──────────────────────────────────────────────────────────────

def _ssh_cmd(remote_cmd: str) -> tuple[int, str, str]:
    base = ["ssh", "-o", "StrictHostKeyChecking=no",
            "-o", "ConnectTimeout=10",
            "-p", str(VPS_PORT)]
    if os.path.isfile(SSH_KEY_PATH):
        base += ["-i", SSH_KEY_PATH]
    r = subprocess.run(
        base + [f"{VPS_USER}@{VPS_HOST}", remote_cmd],
        capture_output=True, text=True, timeout=30)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

# ─── Build Dylibs ─────────────────────────────────────────────────────────────

def build_dylibs(build_store: bool = True, build_ark: bool = True) -> bool:
    """يبني الدايلبين بـ FINALPACKAGE=1 (Production — AES إلزامي، لا Symbols)."""
    print(f"\n{'━'*72}")
    print(f"  🔨 Build Dylibs  (FINALPACKAGE=1 — Production Mode)")
    print(f"{'━'*72}")

    # تحقق من وجود Theos
    _step("① التحقق من Theos...")
    theos = os.environ.get("THEOS", os.path.expanduser("~/theos"))
    if not os.path.isdir(theos):
        _fail(f"THEOS غير موجود في {theos}")
        print("     شغّل: bash -c \"$(curl -fsSL https://raw.githubusercontent.com/theos/theos/master/bin/install-theos)\"")
        return False
    _ok()

    success = True

    # بناء store-dylib
    if build_store:
        _step("② بناء mismari-store.dylib (FINALPACKAGE=1)...")
        r = subprocess.run(
            ["make", "FINALPACKAGE=1", "-j4"],
            cwd=STORE_MAKE_DIR, capture_output=True, text=True)
        if r.returncode != 0:
            _fail(f"\n{r.stderr[-600:]}")
            success = False
        else:
            _ok()
            size = STORE_DYLIB_SRC.stat().st_size // 1024 if STORE_DYLIB_SRC.exists() else 0
            print(f"     → {STORE_DYLIB_SRC}  ({size} KB)")

    # بناء antirevoke
    if build_ark:
        _step("③ بناء antirevoke.dylib (FINALPACKAGE=1)...")
        r = subprocess.run(
            ["make", "FINALPACKAGE=1", "-j4"],
            cwd=ARK_MAKE_DIR, capture_output=True, text=True)
        if r.returncode != 0:
            _fail(f"\n{r.stderr[-600:]}")
            success = False
        else:
            _ok()
            size = ARK_DYLIB_SRC.stat().st_size // 1024 if ARK_DYLIB_SRC.exists() else 0
            print(f"     → {ARK_DYLIB_SRC}  ({size} KB)")

    if success:
        print(f"\n  ✅ البناء مكتمل — AES إلزامي، لا Symbols، arm64+arm64e")
    return success

# ─── Cloudflare R2 Upload ─────────────────────────────────────────────────────

def upload_to_r2(upload_store: bool = True, upload_ark: bool = True) -> bool:
    """يرفع الدايلبين لـ Cloudflare R2 عبر wrangler CLI."""
    print(f"\n{'━'*72}")
    print(f"  ☁️  Cloudflare R2 Upload  →  bucket: {R2_BUCKET}")
    print(f"{'━'*72}")

    # تحقق من wrangler
    _step("① wrangler CLI...")
    r = subprocess.run(["wrangler", "--version"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        _fail("wrangler غير مثبت")
        print("     شغّل: npm install -g wrangler && wrangler login")
        return False
    ver = r.stdout.strip().split("\n")[0]
    print(f"✓  ({ver})")

    env = os.environ.copy()
    if CF_API_TOKEN:
        env["CLOUDFLARE_API_TOKEN"] = CF_API_TOKEN
    if CF_ACCOUNT_ID:
        env["CLOUDFLARE_ACCOUNT_ID"] = CF_ACCOUNT_ID

    success = True
    uploads: list[tuple[str, Path]] = []
    if upload_store and STORE_DYLIB_SRC.exists():
        uploads.append((STORE_DYLIB, STORE_DYLIB_SRC))
    if upload_ark and ARK_DYLIB_SRC.exists():
        uploads.append((ARK_DYLIB, ARK_DYLIB_SRC))

    for obj_name, local_path in uploads:
        _step(f"② رفع {obj_name}  ({local_path.stat().st_size//1024} KB)...")
        r = subprocess.run(
            ["wrangler", "r2", "object", "put",
             f"{R2_BUCKET}/{obj_name}",
             "--file", str(local_path),
             "--content-type", "application/octet-stream"],
            capture_output=True, text=True, env=env)
        if r.returncode != 0:
            _fail(r.stderr[-300:] or r.stdout[-300:])
            success = False
        else:
            _ok()
            print(f"     → {R2_BASE}/{obj_name}")

    if success and uploads:
        print(f"\n  ✅ الرفع مكتمل — الدايلبات متاحة على {R2_BASE}")
    elif not uploads:
        _warn("لم يُعثر على ملفات دايلب — ابنِ أولاً بـ --build")
        success = False
    return success

# ─── SSH Deploy: AES Key ──────────────────────────────────────────────────────

def deploy_aes_key(new_aes: str) -> bool:
    """يرفع MSM_PAYLOAD_KEY الجديد لـ .env على الـ VPS ثم يعيد تشغيل PM2."""
    print(f"\n{'━'*72}")
    print(f"  🔐 SSH Deploy  →  {VPS_USER}@{VPS_HOST}:{VPS_PORT}")
    print(f"     ENV: {VPS_ENV_FILE}  |  PM2: {VPS_PM2_PROC}")
    print(f"{'━'*72}")

    _step("① اختبار SSH...")
    rc, out, err = _ssh_cmd("echo PONG")
    if rc != 0 or "PONG" not in out:
        _fail(err or "لا استجابة")
        print(f"""
  ─── راجع إعداد SSH Key ──────────────────────────────────────────
  ssh-keygen -t ed25519 -C "mismari-deploy" -f ~/.ssh/mismari_deploy
  ssh-copy-id -i ~/.ssh/mismari_deploy.pub {VPS_USER}@{VPS_HOST}

  في tools/.deploy.conf أضف:
    [vps]
    ssh_key = ~/.ssh/mismari_deploy
  ─────────────────────────────────────────────────────────────────""")
        return False
    _ok()

    _step(f"② قراءة {VPS_ENV_FILE}...")
    rc, env_txt, err = _ssh_cmd(f"cat {VPS_ENV_FILE} 2>/dev/null || echo '__EMPTY__'")
    if rc != 0: _fail(err); return False
    _ok()

    _step("③ تحديث MSM_PAYLOAD_KEY...")
    new_line = f"MSM_PAYLOAD_KEY={new_aes}"
    if env_txt == "__EMPTY__":
        new_env = new_line
    elif "MSM_PAYLOAD_KEY=" in env_txt:
        new_env = re.sub(r"^MSM_PAYLOAD_KEY=.*$", new_line,
                         env_txt, flags=re.MULTILINE)
    else:
        new_env = env_txt.rstrip("\n") + "\n" + new_line

    escaped = new_env.replace("\\", "\\\\").replace("'", "'\\''")
    rc, _, err = _ssh_cmd(f"printf '%s' '{escaped}' > {VPS_ENV_FILE}")
    if rc != 0: _fail(err); return False
    _ok()

    _step("④ تحقق من الكتابة...")
    rc, verify, _ = _ssh_cmd(f"grep MSM_PAYLOAD_KEY {VPS_ENV_FILE}")
    if new_aes not in verify:
        _fail("لم تُكتب — تحقق من صلاحيات الملف"); return False
    _ok()

    _step(f"⑤ pm2 restart {VPS_PM2_PROC} --update-env...")
    rc, pm2_out, pm2_err = _ssh_cmd(
        f"pm2 restart {VPS_PM2_PROC} --update-env 2>&1 | tail -2")
    if rc != 0:
        _fail(pm2_err or pm2_out)
        _warn(f"أعد يدوياً: ssh {VPS_USER}@{VPS_HOST} 'pm2 restart {VPS_PM2_PROC} --update-env'")
    else:
        _ok()

    print(f"\n  ✅ Deploy مكتمل  [{datetime.now():%Y-%m-%d %H:%M:%S}]")
    print(f"     السيرفر يستخدم: MSM_PAYLOAD_KEY={new_aes[:4]}{'*'*12}")
    return True

# ─── Admin API Update ─────────────────────────────────────────────────────────

def update_api_settings(version: str, notes: str,
                        admin_token: str | None = None) -> bool:
    """يحدّث store_version و release_notes و store_dylib_url في الـ API."""
    token = admin_token or ADMIN_TOKEN
    if not token:
        print(f"\n  ❌ --update-api يتطلب admin_token")
        print(f"     احصل عليه: POST {ADMIN_URL}/login")
        print(f"     ضعه في .deploy.conf → [api] admin_token = ...")
        return False

    dylib_url = f"{R2_BASE}/{STORE_DYLIB}"
    payload   = {"settings": [
        {"key": "store_version",   "value": version},
        {"key": "release_notes",   "value": notes},
        {"key": "store_dylib_url", "value": dylib_url},
    ]}

    req = urllib.request.Request(
        url=f"{ADMIN_URL}/settings",
        data=json.dumps(payload).encode(),
        method="PUT",
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {token}"}
    )

    print(f"\n{'━'*72}")
    print(f"  📡 Admin API Update  →  {ADMIN_URL}/settings")
    print(f"{'━'*72}")
    _step(f"① store_version={version}  store_dylib_url={dylib_url[:40]}...")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        _ok()
        updated = {s["key"]: s["value"] for s in data.get("settings", [])}
        print(f"     store_version   = {updated.get('store_version', '?')}")
        print(f"     store_dylib_url = {updated.get('store_dylib_url', '?')}")
        print(f"     release_notes   = {updated.get('release_notes', '?')[:55]}...")
        print(f"\n  ✅ API مُحدَّث — المشتركون سيحصلون على التحديث تلقائياً")
        return True

    except urllib.error.HTTPError as e:
        body = e.read().decode()[:300]

        # ─── معالجة خاصة لـ 401 Unauthorized ─────────────────────────────
        if e.code == 401:
            _fail("401 Unauthorized — الـ Token منتهي الصلاحية")
            print(f"""
  ─── تجديد الـ Admin Token ───────────────────────────────────────
  شغّل الأمر التالي للحصول على Token جديد:

    curl -s -X POST {ADMIN_URL}/login \\
      -H "Content-Type: application/json" \\
      -d '{{"username":"USERNAME","password":"PASS","totpCode":"XXXXXX"}}' \\
      | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])"

  ثم حدّث tools/.deploy.conf:
    [api]
    admin_token = eyJhbGci...NEW_TOKEN...

  ملاحظة: الـ JWT عادةً يمتد 24h-7d — دوّره مع كل إصدار.
  ─────────────────────────────────────────────────────────────────""")
        elif e.code == 403:
            _fail(f"403 Forbidden — تأكد من صلاحيات الحساب ({body[:100]})")
        else:
            _fail(f"HTTP {e.code}: {body[:200]}")
        return False

    except urllib.error.URLError as e:
        _fail(f"لا يمكن الوصول للـ API: {e.reason}")
        return False
    except Exception as e:
        _fail(str(e))
        return False

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Mismari Key Rotation & Deploy — بروتوكول الطوارئ الكامل",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(__doc__ or "")
    )
    # مفاتيح التشفير
    g = parser.add_argument_group("🔑 تدوير المفاتيح")
    g.add_argument("--obfuscation",   metavar="0xNN",
                   help="مفتاح XOR جديد لـ Obfuscation.h (مثال: 0xBE)")
    g.add_argument("--antirevoke",    metavar="0xNN",
                   help="مفتاح XOR جديد لـ MSMStrings.h  (مثال: 0x57)")
    g.add_argument("--aes",           metavar="KEY16",
                   help="مفتاح AES-128 جديد (16 حرف بالضبط)")
    # البناء
    g2 = parser.add_argument_group("🔨 البناء")
    g2.add_argument("--build",        action="store_true",
                    help="ابنِ الدايلبين بـ FINALPACKAGE=1 (Production)")
    g2.add_argument("--build-store",  action="store_true",
                    help="ابنِ store-dylib فقط")
    g2.add_argument("--build-ark",    action="store_true",
                    help="ابنِ antirevoke فقط")
    # R2 Upload
    g3 = parser.add_argument_group("☁️  Cloudflare R2")
    g3.add_argument("--upload-r2",    action="store_true",
                    help="ارفع الدايلبين لـ Cloudflare R2 عبر wrangler")
    g3.add_argument("--upload-store", action="store_true",
                    help="ارفع store-dylib فقط")
    g3.add_argument("--upload-ark",   action="store_true",
                    help="ارفع antirevoke فقط")
    # VPS Deploy
    g4 = parser.add_argument_group("🔐 VPS Deploy")
    g4.add_argument("--deploy",       action="store_true",
                    help="ارفع مفتاح AES الجديد للـ VPS عبر SSH")
    g4.add_argument("--ssh-password", metavar="PASS",
                    help="كلمة مرور SSH (الأفضل: استخدم SSH key)")
    # Admin API
    g5 = parser.add_argument_group("📡 Admin API")
    g5.add_argument("--update-api",   action="store_true",
                    help="حدّث store_version/store_dylib_url في الـ API")
    g5.add_argument("--dylib-version",metavar="VER",  default="",
                    help="رقم الإصدار (مثال: 2.1)")
    g5.add_argument("--dylib-notes",  metavar="TEXT",
                    default="تحسينات وإصلاحات.",
                    help="ملاحظات الإصدار")
    g5.add_argument("--admin-token",  metavar="JWT",
                    help="JWT للـ Admin API (أو في .deploy.conf)")
    args = parser.parse_args()

    has_action = any([
        args.obfuscation, args.antirevoke, args.aes,
        args.build, args.build_store, args.build_ark,
        args.upload_r2, args.upload_store, args.upload_ark,
        args.deploy, args.update_api
    ])
    if not has_action:
        parser.print_help(); sys.exit(0)

    # تحذير عند غياب .deploy.conf وهناك عمليات تتطلبه
    needs_conf = args.deploy or args.update_api or args.upload_r2
    if needs_conf and not _CONF_PATH.exists():
        print(f"\n  ⚠️  لا يوجد {_CONF_PATH.name}")
        print(f"     شغّل: cp tools/.deploy.conf.template tools/.deploy.conf")
        print(f"     (.deploy.conf مُدرج في .gitignore — آمن للأسرار)\n")

    # ── تدوير Obfuscation.h ────────────────────────────────────────────────
    if args.obfuscation:
        new_key = int(args.obfuscation, 16)
        print(f"\n{EQ}")
        print(f"  Obfuscation.h   OLD=0x{CURRENT_OBF_KEY:02X}  →  NEW=0x{new_key:02X}")
        print(f"{EQ}\n")
        print("/* ─── Strings ──────────────────────────────── */")
        for name, text in OBFUSCATION_STRINGS:
            print(gen_str_define(name, text, new_key))
        print()
        print("/* ─── JailBreak Paths (EP0-EP28) ───────────── */")
        for idx, p in enumerate(JB_PATHS):
            print(gen_jb_define(idx, p, new_key))
        print()
        if args.aes:
            print(gen_aes_define(args.aes, new_key))
            print()
        print(SEP)
        print("خطوات Obfuscation.h:")
        print(f"  1. '#define _XK 0x{CURRENT_OBF_KEY:02X}'  →  '#define _XK 0x{new_key:02X}'")
        print(f"  2. انسخ التعريفات أعلاه إلى Obfuscation.h")
        print(f"  3. make FINALPACKAGE=1   ← لا NDEBUG في Debug = AES معطَّل!")

    # ── تدوير MSMStrings.h ─────────────────────────────────────────────────
    if args.antirevoke:
        new_key = int(args.antirevoke, 16)
        print(f"\n{EQ}")
        print(f"  MSMStrings.h    OLD=0x{CURRENT_ARK_KEY:02X}  →  NEW=0x{new_key:02X}")
        print(f"{EQ}\n")
        for name, text in ANTIREVOKE_STRINGS:
            print(gen_ark_define(name, text, new_key))
        print()
        print(SEP)
        print("خطوات MSMStrings.h:")
        print(f"  1. 'MSM_KEY 0x{CURRENT_ARK_KEY:02X}'  →  'MSM_KEY 0x{new_key:02X}'")
        print(f"  2. انسخ MSM_DEF lines أعلاه إلى MSMStrings.h")
        print(f"  3. make FINALPACKAGE=1")

    # ── AES Key فقط (بدون --obfuscation) ──────────────────────────────────
    if args.aes and not args.obfuscation:
        aes = args.aes
        if len(aes) != 16:
            print(f"❌  AES يجب 16 حرف بالضبط ({len(aes)} أُعطي)", file=sys.stderr)
            sys.exit(1)
        print(f"\n{EQ}")
        print(f"  AES-128   OLD={CURRENT_AES_KEY!r}  →  NEW={aes!r}")
        print(f"{EQ}\n")
        print("// في Obfuscation.h — استبدل _ENC_AESKEY:")
        print(gen_aes_define(aes, CURRENT_OBF_KEY))
        print(f"\n// في .env السيرفر:\n// MSM_PAYLOAD_KEY=\"{aes}\"")
        print(f"\n{SEP}")
        print("خطوات AES:")
        print("  1. حدّث _ENC_AESKEY في Obfuscation.h")
        print("  2. make FINALPACKAGE=1  (ينشّط AES-mandatory في Production)")
        print("  3. --deploy أو أضف يدوياً لـ .env السيرفر")

    # ── Build ──────────────────────────────────────────────────────────────
    do_store = args.build or args.build_store
    do_ark   = args.build or args.build_ark
    if do_store or do_ark:
        build_dylibs(build_store=do_store, build_ark=do_ark)

    # ── R2 Upload ──────────────────────────────────────────────────────────
    up_store = args.upload_r2 or args.upload_store
    up_ark   = args.upload_r2 or args.upload_ark
    if up_store or up_ark:
        upload_to_r2(upload_store=up_store, upload_ark=up_ark)

    # ── SSH Deploy ─────────────────────────────────────────────────────────
    if args.deploy:
        if not args.aes:
            print("\n❌  --deploy يتطلب --aes", file=sys.stderr); sys.exit(1)
        deploy_aes_key(args.aes)

    # ── Admin API Update ───────────────────────────────────────────────────
    if args.update_api:
        version = args.dylib_version
        if not version:
            version = input("\n  رقم الإصدار الجديد (مثال: 2.1): ").strip()
            if not version:
                print("❌  أدخل رقم الإصدار", file=sys.stderr); sys.exit(1)
        update_api_settings(version, args.dylib_notes, args.admin_token)

    print()

if __name__ == "__main__":
    main()
