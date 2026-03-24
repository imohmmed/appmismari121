import fs from "fs";
import path from "path";

const BLOCKED_HOSTS = [
  "ocsp.apple.com",
  "ocsp2.apple.com",
  "valid.apple.com",
  "crl.apple.com",
  "certs.apple.com",
  "appattest.apple.com",
];

const MH_MAGIC_64 = 0xfeedfacf;
const MH_DYLIB = 0x6;
const MH_PIE = 0x200000;
const MH_TWOLEVEL = 0x80;
const MH_DYLDLINK = 0x4;
const MH_NOUNDEFS = 0x1;

const CPU_TYPE_ARM64 = 0x0100000c;
const CPU_SUBTYPE_ARM64_ALL = 0x0;

const LC_SEGMENT_64 = 0x19;
const LC_ID_DYLIB = 0x0d;
const LC_DYLD_INFO_ONLY = 0x80000022;
const LC_SYMTAB = 0x02;
const LC_DYSYMTAB = 0x0b;
const LC_UUID = 0x1b;
const LC_LOAD_DYLIB = 0x0c;
const LC_SOURCE_VERSION = 0x2a;
const LC_BUILD_VERSION = 0x32;

const S_REGULAR = 0x0;
const S_INTERPOSING = 0xd;
const S_CSTRING_LITERALS = 0x2;

const PLATFORM_IOS = 2;

function align(n, a) { return (n + a - 1) & ~(a - 1); }

function writeStr16(buf, offset, s) {
  for (let i = 0; i < 16; i++) buf[offset + i] = i < s.length ? s.charCodeAt(i) : 0;
}

function writeCStr(buf, offset, s) {
  for (let i = 0; i < s.length; i++) buf[offset + i] = s.charCodeAt(i);
  buf[offset + s.length] = 0;
  return s.length + 1;
}

function generateArm64Code(blockedHosts, cstringOffsets, textVmAddr, cstringVmAddr) {
  const insns = [];

  function emit(val) { insns.push(val >>> 0); }

  function adrpAndAdd(reg, targetAddr, pcAddr) {
    const page = (targetAddr >>> 12) - (pcAddr >>> 12);
    const pageOff = targetAddr & 0xfff;
    const immhi = (page >> 2) & 0x7ffff;
    const immlo = page & 0x3;
    emit(0x90000000 | (immhi << 5) | (immlo << 29) | reg);
    emit(0x91000000 | (pageOff << 10) | (reg << 5) | reg);
  }

  emit(0xd10103ff);
  emit(0xa9017bfd);
  emit(0xa9027fa0);
  emit(0xa9037fa2);
  emit(0x910003fd);

  emit(0xf9000fe0);

  emit(0xb4000280 | 0);

  let branchFixups = [];

  for (let i = 0; i < blockedHosts.length; i++) {
    const hostAddr = cstringVmAddr + cstringOffsets[i];
    const currentPc = textVmAddr + insns.length * 4;

    adrpAndAdd(1, hostAddr, currentPc);

    emit(0xf9400fe0);

    const blFixup = insns.length;
    emit(0x94000000);
    branchFixups.push({ idx: blFixup, target: "_strcmp" });

    emit(0x34000060);
    branchFixups.push({ idx: insns.length - 1, type: "cbz_skip" });

    emit(0x52800040);
    emit(0x14000000);
    branchFixups.push({ idx: insns.length - 1, type: "b_epilog" });
  }

  for (const fix of branchFixups) {
    if (fix.type === "cbz_skip") {
      const target = fix.idx + 1;
      const diff = target - fix.idx;
      insns[fix.idx] = 0x34000000 | ((diff & 0x7ffff) << 5) | 0;
    }
  }

  const origCallIdx = insns.length;
  emit(0xf9400fe0);
  emit(0xa9437fa2);
  emit(0xa9427fa0);

  const origBl = insns.length;
  emit(0x94000000);
  branchFixups.push({ idx: origBl, target: "_getaddrinfo" });

  const epilogIdx = insns.length;
  emit(0xa9417bfd);
  emit(0x910103ff);
  emit(0xd65f03c0);

  for (const fix of branchFixups) {
    if (fix.type === "b_epilog") {
      const diff = epilogIdx - fix.idx;
      insns[fix.idx] = 0x14000000 | (diff & 0x3ffffff);
    }
  }

  const buf = Buffer.alloc(insns.length * 4);
  for (let i = 0; i < insns.length; i++) buf.writeUInt32LE(insns[i], i * 4);
  return buf;
}

function buildDylib() {
  const cstrings = Buffer.alloc(4096);
  let coff = 0;
  const hostOffsets = [];
  for (const h of BLOCKED_HOSTS) {
    hostOffsets.push(coff);
    coff += writeCStr(cstrings, coff, h);
  }
  const dynameOff = coff;
  coff += writeCStr(cstrings, coff, "@rpath/antirevoke.dylib");
  const cstringSize = align(coff, 8);

  const textVmAddr = 0x4000;
  const cstringVmAddr = 0x8000;

  const textCode = Buffer.alloc(1024);
  let codeOff = 0;

  function emit32(val) {
    textCode.writeUInt32LE(val >>> 0, codeOff);
    codeOff += 4;
  }

  emit32(0xa9be7bfd);
  emit32(0x910003fd);
  emit32(0xf81f0fe0);
  emit32(0xb40001a0);

  for (let i = 0; i < BLOCKED_HOSTS.length; i++) {
    const hostAddr = cstringVmAddr + hostOffsets[i];
    const pc = textVmAddr + codeOff;
    const page = ((hostAddr >>> 12) - (pc >>> 12)) & 0x1fffff;
    const pageOff = hostAddr & 0xfff;
    const immhi = (page >> 2) & 0x7ffff;
    const immlo = page & 0x3;
    emit32(0x90000000 | (immhi << 5) | (immlo << 29) | 1);
    emit32(0x91000000 | (pageOff << 10) | (1 << 5) | 1);

    emit32(0xf85f0fe0);

    emit32(0x94000000);

    const skipOff = 3;
    emit32(0x35000000 | ((skipOff & 0x7ffff) << 5) | 0);
  }

  emit32(0xf85f0fe0);
  const origBranch = codeOff;
  emit32(0x94000000);

  const retInstr = codeOff;
  emit32(0x14000000 | 2);

  emit32(0xd2800080);

  emit32(0xa8c27bfd);
  emit32(0xd65f03c0);

  const textSize = align(codeOff, 16);

  const interposeData = Buffer.alloc(16);

  const dataVmAddr = 0xc000;
  const interposeVmAddr = dataVmAddr;

  const symtabStrtab = Buffer.alloc(512);
  let soff = 0;
  soff += writeCStr(symtabStrtab, soff, " ");
  const stridxMyGai = soff;
  soff += writeCStr(symtabStrtab, soff, "_my_getaddrinfo");
  const stridxGai = soff;
  soff += writeCStr(symtabStrtab, soff, "_getaddrinfo");
  const stridxStrcmp = soff;
  soff += writeCStr(symtabStrtab, soff, "_strcmp");
  const strtabSize = align(soff, 8);

  const NLIST_SIZE = 16;
  const numSyms = 3;
  const symtab = Buffer.alloc(numSyms * NLIST_SIZE);

  function writeNlist(buf, idx, strx, type, sect, desc, value) {
    const off = idx * NLIST_SIZE;
    buf.writeUInt32LE(strx, off);
    buf.writeUInt8(type, off + 4);
    buf.writeUInt8(sect, off + 5);
    buf.writeUInt16LE(desc, off + 6);
    buf.writeUInt32LE(value & 0xffffffff, off + 8);
    buf.writeUInt32LE((value / 0x100000000) >>> 0, off + 12);
  }

  const N_EXT = 0x01;
  const N_UNDF = 0x0;
  const N_SECT = 0xe;
  const REFERENCE_FLAG_UNDEFINED_NON_LAZY = 0x0;

  writeNlist(symtab, 0, stridxGai, N_EXT | N_UNDF, 0, REFERENCE_FLAG_UNDEFINED_NON_LAZY, 0);
  writeNlist(symtab, 1, stridxStrcmp, N_EXT | N_UNDF, 0, REFERENCE_FLAG_UNDEFINED_NON_LAZY, 0);
  writeNlist(symtab, 2, stridxMyGai, N_EXT | N_SECT, 1, 0, textVmAddr);

  const headerSize = 32;
  const numLoadCmds = 7;

  const lcSegText = 72 + 2 * 80;
  const lcSegData = 72 + 1 * 80;
  const lcSegLinkedit = 72;
  const lcIdDylib = 24 + align("@rpath/antirevoke.dylib".length + 1, 8);
  const lcUuid = 24;
  const lcSymtabSize = 24;
  const lcDysymtabSize = 80;

  const allLcSize = lcSegText + lcSegData + lcSegLinkedit + lcIdDylib + lcUuid + lcSymtabSize + lcDysymtabSize;
  const headerAndLc = align(headerSize + allLcSize, 0x1000);

  const textFileOff = headerAndLc;
  const cstringFileOff = textFileOff + align(textSize, 16);
  const dataFileOff = align(cstringFileOff + cstringSize, 0x1000);
  const interposeFileOff = dataFileOff;
  const linkeditFileOff = align(dataFileOff + 16, 0x1000);
  const symtabFileOff = linkeditFileOff;
  const strtabFileOff = symtabFileOff + symtab.length;
  const totalSize = align(strtabFileOff + strtabSize, 16);

  const linkeditVmAddr = 0x10000;

  const buf = Buffer.alloc(totalSize + 0x1000);
  let w = 0;

  function w32(v) { buf.writeUInt32LE(v >>> 0, w); w += 4; }
  function w64(v) {
    buf.writeUInt32LE(v & 0xffffffff, w);
    buf.writeUInt32LE((v / 0x100000000) >>> 0, w + 4);
    w += 8;
  }

  w32(MH_MAGIC_64);
  w32(CPU_TYPE_ARM64);
  w32(CPU_SUBTYPE_ARM64_ALL);
  w32(MH_DYLIB);
  w32(numLoadCmds);
  w32(allLcSize);
  w32(MH_NOUNDEFS | MH_DYLDLINK | MH_TWOLEVEL | MH_PIE);
  w32(0);

  w32(LC_SEGMENT_64);
  w32(lcSegText);
  writeStr16(buf, w, "__TEXT"); w += 16;
  w64(0);
  w64(headerAndLc + align(textSize, 16) + cstringSize);
  w64(0);
  w64(headerAndLc + align(textSize, 16) + cstringSize);
  w32(5);
  w32(5);
  w32(2);
  w32(0);

  writeStr16(buf, w, "__text"); w += 16;
  writeStr16(buf, w, "__TEXT"); w += 16;
  w64(textVmAddr);
  w64(textSize);
  w32(textFileOff);
  w32(2);
  w32(0);
  w32(0);
  w32(0x80000400);
  w32(0);
  w32(0);
  w32(0);

  writeStr16(buf, w, "__cstring"); w += 16;
  writeStr16(buf, w, "__TEXT"); w += 16;
  w64(cstringVmAddr);
  w64(cstringSize);
  w32(cstringFileOff);
  w32(0);
  w32(0);
  w32(0);
  w32(S_CSTRING_LITERALS);
  w32(0);
  w32(0);
  w32(0);

  w32(LC_SEGMENT_64);
  w32(lcSegData);
  writeStr16(buf, w, "__DATA"); w += 16;
  w64(dataVmAddr);
  w64(0x1000);
  w64(dataFileOff);
  w64(16);
  w32(3);
  w32(3);
  w32(1);
  w32(0);

  writeStr16(buf, w, "__interpose"); w += 16;
  writeStr16(buf, w, "__DATA"); w += 16;
  w64(interposeVmAddr);
  w64(16);
  w32(interposeFileOff);
  w32(3);
  w32(0);
  w32(0);
  w32(S_INTERPOSING);
  w32(0);
  w32(0);
  w32(0);

  w32(LC_SEGMENT_64);
  w32(lcSegLinkedit);
  writeStr16(buf, w, "__LINKEDIT"); w += 16;
  w64(linkeditVmAddr);
  w64(align(symtab.length + strtabSize, 0x1000));
  w64(linkeditFileOff);
  w64(symtab.length + strtabSize);
  w32(1);
  w32(1);
  w32(0);
  w32(0);

  w32(LC_ID_DYLIB);
  w32(lcIdDylib);
  w32(24);
  w32(0x10000);
  w32(0x10000);
  w32(0x10000);
  const nameBytes = Buffer.from("@rpath/antirevoke.dylib\0");
  nameBytes.copy(buf, w);
  w += align(nameBytes.length, 8);

  w32(LC_UUID);
  w32(lcUuid);
  for (let i = 0; i < 16; i++) buf[w++] = Math.floor(Math.random() * 256);

  w32(LC_SYMTAB);
  w32(lcSymtabSize);
  w32(symtabFileOff);
  w32(numSyms);
  w32(strtabFileOff);
  w32(strtabSize);

  w32(LC_DYSYMTAB);
  w32(lcDysymtabSize);
  w32(0); w32(2);
  w32(2); w32(1);
  w32(0); w32(0);
  w32(0); w32(0);
  w32(0); w32(0);
  w32(0); w32(0);
  w32(0); w32(0);

  textCode.copy(buf, textFileOff, 0, textSize);
  cstrings.copy(buf, cstringFileOff, 0, cstringSize);

  interposeData.writeUInt32LE(textVmAddr & 0xffffffff, 0);
  interposeData.writeUInt32LE(0, 4);
  interposeData.writeUInt32LE(0, 8);
  interposeData.writeUInt32LE(0, 12);
  interposeData.copy(buf, interposeFileOff);

  symtab.copy(buf, symtabFileOff);
  symtabStrtab.copy(buf, strtabFileOff, 0, strtabSize);

  return buf.slice(0, totalSize);
}

try {
  const dylib = buildDylib();
  const outDir = path.join(process.cwd(), "uploads", "dylibs");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "antirevoke.dylib");
  fs.writeFileSync(outPath, dylib);
  console.log(`✅ Anti-Revoke dylib built: ${outPath} (${dylib.length} bytes)`);
} catch (err) {
  console.error("❌ Failed:", err);
}
