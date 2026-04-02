#!/usr/bin/env python3
"""
patch_weak.py — يحول LC_LOAD_DYLIB لـ CydiaSubstrate إلى LC_LOAD_WEAK_DYLIB
في كل architectures الموجودة في الـ fat binary.

الفرق:
  LC_LOAD_DYLIB (0x0C)       → crash لو مش موجود على الجهاز
  LC_LOAD_WEAK_DYLIB (0x18)  → يكمل التحميل حتى لو غير موجود

يُشغَّل تلقائياً بعد build من الـ Makefile.
"""

import struct
import sys
import os

SUBSTRATE_PATH = b'/Library/Frameworks/CydiaSubstrate.framework/CydiaSubstrate'
LC_LOAD_DYLIB      = 0x0000000C
LC_LOAD_WEAK_DYLIB = 0x00000018
FAT_MAGIC          = 0xCAFEBABE
MH_MAGIC_64        = 0xFEEDFACF


def patch_arch(data: bytearray, arch_offset: int):
    """Patch a single Mach-O arch inside data (in-place)."""
    # Mach-O header is little-endian on ARM64/x86_64
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

        if cmd == LC_LOAD_DYLIB:
            nameoff = struct.unpack_from('<I', data, cmd_offset + 8)[0]
            name_start = cmd_offset + nameoff
            # Compare against Substrate path
            if data[name_start:name_start + len(SUBSTRATE_PATH)] == SUBSTRATE_PATH:
                struct.pack_into('<I', data, cmd_offset, LC_LOAD_WEAK_DYLIB)
                print(f"  ✓ Patched arch@{arch_offset:#x}: "
                      f"LC_LOAD_DYLIB → LC_LOAD_WEAK_DYLIB for CydiaSubstrate")

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
        # Single arch
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
