#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function findPlistFile(startDir) {
  const pnpmStore = path.join(startDir, "node_modules", ".pnpm");
  if (!fs.existsSync(pnpmStore)) return null;
  let entries;
  try { entries = fs.readdirSync(pnpmStore); } catch { return null; }
  for (const d of entries) {
    if (!d.startsWith("@expo+plist@")) continue;
    const p = path.join(pnpmStore, d, "node_modules", "@expo", "plist", "build", "parse.js");
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Walk up from __dirname to find project root that has node_modules/.pnpm
let searchDir = __dirname;
let file = null;
for (let i = 0; i < 6; i++) {
  file = findPlistFile(searchDir);
  if (file) break;
  const parent = path.dirname(searchDir);
  if (parent === searchDir) break;
  searchDir = parent;
}

if (!file) {
  // Also try direct path under current working directory
  file = findPlistFile(process.cwd());
}

if (!file) {
  console.log("patch-plist: @expo/plist not found, skipping.");
  process.exit(0);
}

let src;
try { src = fs.readFileSync(file, "utf8"); } catch (e) {
  console.log("patch-plist: could not read file:", e.message);
  process.exit(0);
}

if (src.includes('"text/xml"') || src.includes("'text/xml'")) {
  console.log("patch-plist: already patched ✅");
  process.exit(0);
}

const patched = src.replace(
  /parseFromString\(([^,)]+),\s*([^)]+)\)/g,
  (match, xmlArg, mimeArg) => {
    const trimmed = mimeArg.trim();
    if (trimmed === '"text/xml"' || trimmed === "'text/xml'") return match;
    return `parseFromString(${xmlArg}, ${trimmed} || "text/xml")`;
  }
);

if (patched === src) {
  console.log("patch-plist: no changes needed or pattern not matched.");
  process.exit(0);
}

try {
  fs.writeFileSync(file, patched, "utf8");
  console.log("patch-plist: patched ✅", file);
} catch (e) {
  console.log("patch-plist: write failed:", e.message);
}
