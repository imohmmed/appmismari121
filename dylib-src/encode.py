#!/usr/bin/env python3
"""
Mismari Dylib — String Encoder
لتشفير نص جديد للإضافة في MSMStrings.h:

    python3 encode.py "ocsp.apple.com"
    python3 encode.py "/Library/MobileSubstrate"
"""
import sys

KEY = 0x42  # Fixed XOR key

def encode(s: str) -> str:
    bs = s.encode()
    hex_vals = ", ".join(f"0x{b ^ KEY:02X}" for b in bs)
    return f"{{ {hex_vals} }}  /* {len(bs)} bytes — \"{s}\" */"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 encode.py \"string to encode\"")
        sys.exit(1)
    print(encode(sys.argv[1]))
