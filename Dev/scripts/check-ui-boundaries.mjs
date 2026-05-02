#!/usr/bin/env node
// Boundary checker for frontend module directions.
//
// Fails if any file under src/frontend/components/ or src/frontend/charts/
// imports from a page folder (frontend/analysis_*, frontend/trade_*,
// frontend/news_page, frontend/snapshot).
//
// Reads the baseline allowlist from scripts/baseline_ui_boundaries.txt.
// Each line is either blank, a "# comment", or an entry of the form:
//   <sourceFile>\t<importSpecifier>
//
// Exit code 0: current hit set is a subset of the allowlist.
// Exit code 1: a hit exists that is not in the allowlist.
//
// Usage:
//   node scripts/check-ui-boundaries.mjs                 # verify
//   node scripts/check-ui-boundaries.mjs --write-baseline # snapshot current state

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const frontendRoot = resolve(repoRoot, "src", "frontend");
const allowlistPath = resolve(__dirname, "baseline_ui_boundaries.txt");

const GUARDED_ROOTS = ["components", "charts"];
const PAGE_PREFIXES = [
  "analysis_",
  "trade_",
  "news_page/",
  "news_page\\",
  "snapshot/",
  "snapshot\\",
];

const IMPORT_REGEX = /import[\s\S]*?from\s+["']([^"']+)["']/g;
const SIDE_EFFECT_REGEX = /import\s+["']([^"']+)["']/g;
const REEXPORT_REGEX = /export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".dist" || entry === "dist") continue;
      out.push(...walk(full));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function normalize(p) {
  return p.split(sep).join("/");
}

function resolveImportToFrontendPath(sourceFile, spec) {
  if (spec.startsWith(".")) {
    const absolute = resolve(dirname(sourceFile), spec);
    const rel = normalize(relative(frontendRoot, absolute));
    if (rel.startsWith("..")) return null;
    return rel;
  }
  return null;
}

function frontendPathIsPage(p) {
  for (const prefix of PAGE_PREFIXES) {
    if (p.startsWith(prefix)) return true;
  }
  return false;
}

function frontendPathIsGuardedRoot(p) {
  for (const root of GUARDED_ROOTS) {
    if (p === root) return true;
    if (p.startsWith(root + "/")) return true;
  }
  return false;
}

function collectImports(source) {
  const specs = new Set();
  const pushFrom = (regex) => {
    let m;
    while ((m = regex.exec(source)) !== null) specs.add(m[1]);
  };
  pushFrom(IMPORT_REGEX);
  pushFrom(SIDE_EFFECT_REGEX);
  pushFrom(REEXPORT_REGEX);
  return Array.from(specs);
}

function readAllowlist() {
  if (!existsSync(allowlistPath)) return new Set();
  try {
    const text = readFileSync(allowlistPath, "utf8");
    const out = new Set();
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      out.add(line);
    }
    return out;
  } catch {
    return new Set();
  }
}

function main() {
  const files = walk(frontendRoot);
  const hits = [];
  for (const file of files) {
    const relFront = normalize(relative(frontendRoot, file));
    if (!frontendPathIsGuardedRoot(relFront)) continue;
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const specs = collectImports(text);
    for (const spec of specs) {
      const target = resolveImportToFrontendPath(file, spec);
      if (target === null) continue;
      if (!frontendPathIsPage(target)) continue;
      hits.push(`${relFront}\t${spec}`);
    }
  }
  hits.sort();

  const writeBaseline = process.argv.includes("--write-baseline");
  if (writeBaseline) {
    const header = [
      "# Baseline of known components/charts -> page imports.",
      "# Each line: <source-file-relative-to-src/frontend>\\t<import-specifier>",
      "# This list may SHRINK over phases. It must never grow.",
      "",
    ].join("\n");
    writeFileSync(allowlistPath, header + hits.join("\n") + "\n", "utf8");
    console.log(`wrote baseline with ${hits.length} entries`);
    return;
  }

  const allow = readAllowlist();
  const unexpected = hits.filter((h) => !allow.has(h));
  if (unexpected.length > 0) {
    console.error(`UI boundary check FAILED: ${unexpected.length} unexpected upward imports`);
    for (const u of unexpected) console.error("  " + u);
    process.exit(1);
  }
  console.log(`UI boundary check passed: ${hits.length}/${allow.size} allowlisted hits`);
}

main();
