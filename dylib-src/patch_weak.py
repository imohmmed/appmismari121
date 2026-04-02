#!/usr/bin/env python3
"""
patch_weak.py — إصلاحات ما بعد البناء لـ antirevoke.dylib

الخطوة 1: LC_LOAD_DYLIB (CydiaSubstrate) → LC_LOAD_WEAK_DYLIB
الخطوة 2: LC_ID_DYLIB → @executable_path/antirevoke.dylib

يُشغَّل تلقائياً بعد build من الـ Makefile.
"""

import struct
import sys
import os

SUBSTRATE_PATH    = b'/Library/Frameworks/CydiaSubstrate.framework/CydiaSubstrate'
SUBSTRATE_PATH2   = b'/Library/MobileSubstrate/MobileSubstrate.dylib'
TARGET_INSTALL    = b'@executable_path/antirevoke.dylib'

LC_LOAD_DYLIB      = 0x0000000C
LC_LOAD_WEAK_DYLIB = 0x00000018
LC_ID_DYLIB        = 0x0000000D
FAT_MAGIC          = 0xCAFEBABE
MH_MAGIC_64        = 0xFEEDFACF


def patch_arch(data: bytearray, arch_offset: int):
    """Patch a single Mach-O arch inside data (in-place)."""
    magic = struct.unpack_from('<I', data, arch_offset)[0]
    if magic != MH_MAGIC_64:
        return

    ncmds      = struct.unpack_from('<I', data, arch_offset + 16)[0]
    cmd_offset = arch_offset + 32  # sizeof(mach_header_64)

    for _ in range(ncmds):
        cmd     = struct.unpack_from('<I', data, cmd_offset)[0]
        cmdsize = struct.unpack_from('<I', data, cmd_offset + 4)[0]
        if cmdsize == 0:
            break

        # ── الخطوة 1: Substrate → WEAK ─────────────────────────────────────
        if cmd == LC_LOAD_DYLIB:
            nameoff    = struct.unpack_from('<I', data, cmd_offset + 8)[0]
            name_start = cmd_offset + nameoff
            for sub_path in (SUBSTRATE_PATH, SUBSTRATE_PATH2):
                if data[name_start:name_start + len(sub_path)] == sub_path:
                    struct.pack_into('<I', data, cmd_offset, LC_LOAD_WEAK_DYLIB)
                    print(f"  ✓ Patched arch@{arch_offset:#x}: "
                          f"LC_LOAD_DYLIB → LC_LOAD_WEAK_DYLIB for {sub_path.decode()}")
                    break

        # ── الخطوة 2: LC_ID_DYLIB → @executable_path/antirevoke.dylib ──────
        elif cmd == LC_ID_DYLIB:
            nameoff    = struct.unpack_from('<I', data, cmd_offset + 8)[0]
            name_start = cmd_offset + nameoff
            name_end   = cmd_offset + cmdsize
            # قراءة الاسم الحالي
            raw        = data[name_start:name_end]
            cur_name   = raw.split(b'\x00')[0]

            if cur_name != TARGET_INSTALL:
                # التحقق أن الاسم الجديد يتناسب في المساحة المتاحة
                avail = name_end - name_start
                if len(TARGET_INSTALL) + 1 <= avail:
                    # امسح المنطقة ثم اكتب الاسم الجديد
                    data[name_start:name_end] = b'\x00' * avail
                    data[name_start:name_start + len(TARGET_INSTALL)] = TARGET_INSTALL
                    print(f"  ✓ Patched LC_ID_DYLIB: {cur_name.decode('utf-8', errors='replace')!r}"
                          f" → {TARGET_INSTALL.decode()!r}")
                else:
                    print(f"  ⚠ LC_ID_DYLIB: لا مساحة كافية للتصحيح "
                          f"(need {len(TARGET_INSTALL)+1}, have {avail})")
            else:
                print(f"  ✓ LC_ID_DYLIB: صحيح بالفعل ({TARGET_INSTALL.decode()!r})")

        cmd_offset += cmdsize


def patch_dylib(path: str):
    with open(path, 'rb') as f:
        data = bytearray(f.read())

    fat_magic = struct.unpack_from('>I', data, 0)[0]

    if fat_magic == FAT_MAGIC:
        nfat = struct.unpack_from('>I', data, 4)[0]
        print(f"Fat binary — {nfat} architectures")
        for i in range(nfat):
            entry_offset = 8 + i * 20
            arch_offset  = struct.unpack_from('>I', data, entry_offset + 8)[0]
            patch_arch(data, arch_offset)
    else:
        print("Single-arch binary")
        patch_arch(data, 0)

    with open(path, 'wb') as f:
        f.write(data)
    print(f"  → Written: {path}  ({os.path.getsize(path):,} bytes)")


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path-to.dylib>")
        sys.exit(1)

    target = sys.argv[1]
    if not os.path.exists(target):
        print(f"ERROR: {target} not found")
        sys.exit(1)

    print(f"Patching: {target}")
    patch_dylib(target)
    print("Done.")
