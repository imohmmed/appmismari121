#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const candidates = [
  path.resolve(__dirname, "../node_modules/@expo/plist/build/parse.js"),
  path.resolve(__dirname, "../../../node_modules/.pnpm/@expo+plist@0.4.8/node_modules/@expo/plist/build/parse.js"),
];

function findFile() {
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  const base = path.resolve(__dirname, "../../../node_modules/.pnpm");
  if (!fs.existsSync(base)) return null;
  const dirs = fs.readdirSync(base).filter((d) => d.startsWith("@expo+plist@"));
  for (const d of dirs) {
    const p = path.join(base, d, "node_modules/@expo/plist/build/parse.js");
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const file = findFile();
if (!file) {
  console.log("patch-plist: @expo/plist not found, skipping.");
  process.exit(0);
}

let src = fs.readFileSync(file, "utf8");
if (src.includes("mimeType || \"text/xml\"") || src.includes("mimeType||\"text/xml\"")) {
  console.log("patch-plist: already patched ✅");
  process.exit(0);
}

const patched = src
  .replace(
    /parseFromString\(xmlString,\s*mimeType\)/g,
    'parseFromString(xmlString, mimeType || "text/xml")'
  )
  .replace(
    /\.parseFromString\(([^,)]+),\s*undefined\)/g,
    '.parseFromString($1, "text/xml")'
  );

if (patched === src) {
  console.log("patch-plist: pattern not found, attempting broader fix...");
  const broader = src.replace(
    /(parser\.parseFromString\([^)]+\))/g,
    (match) => {
      if (match.includes('"text/xml"') || match.includes("'text/xml'")) return match;
      return match.replace(/\)$/, ', "text/xml")').replace(/,\s*"text\/xml",\s*"text\/xml"/, ', "text/xml"');
    }
  );
  if (broader !== src) {
    fs.writeFileSync(file, broader, "utf8");
    console.log("patch-plist: patched (broader) ✅", file);
  } else {
    console.log("patch-plist: could not patch automatically, manual fix needed.");
  }
} else {
  fs.writeFileSync(file, patched, "utf8");
  console.log("patch-plist: patched ✅", file);
}
