#!/usr/bin/env node
// Time / timezone rule checker — encodes the rules from
// .docs/devPlan/regulation/Timezone.md as static scans across Dev/src.
//
// Reads a baseline allowlist from scripts/baseline_time_rules.txt so existing
// pre-rule violations don't break CI. The baseline may SHRINK (fixes are
// welcome) but must never grow.
//
// Usage:
//   node scripts/check-time-rules.mjs                  # verify
//   node scripts/check-time-rules.mjs --write-baseline # snapshot current state

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const SRC = path.join(ROOT, "src");
const SELF_REL = path.normalize("scripts/check-time-rules.mjs");
const BASELINE_PATH = path.join(SCRIPT_DIR, "baseline_time_rules.txt");

const TEXT_FILE_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".md"]);
const IGNORE_DIRS = new Set(["node_modules", ".dist", "dist", ".git"]);

// Files allowed to hardcode "America/Chicago" — these are the canonical
// time helpers and config files where the IANA name must literally appear.
const ALLOW_HARDCODED_CHICAGO = new Set([
  path.normalize("src/shared/utils/time.ts"),
]);

const failures = [];

const LOCALE_METHOD_RE = /\.toLocale(DateString|TimeString)\(/;
const DATE_LOCALE_STRING_RE =
  /(?:new Date\([^)]*\)|\bd\b|[A-Za-z_$][\w$]*(?:Date|Time|Timestamp|Ts|Dt))\.toLocaleString\(/;
const SENTINEL_DATE_RE = /["'`]1970-01-01["'`]/;
const ZERO_TIME_FALLBACK_RE =
  /(?:publishedAtUtcMs|fetchedAtUtcMs|requestedAtUtcMs|completedAtUtcMs|capturedAtUtcMs|dataAsOfUtcMs).*\?\?\s*0|\?\?\s*0.*(?:publishedAtUtcMs|fetchedAtUtcMs|requestedAtUtcMs|completedAtUtcMs|capturedAtUtcMs|dataAsOfUtcMs)/;
const DATE_NOW_FALLBACK_RE =
  /(?:AtUtcMs|dataAsOfUtcMs).*(?:\?\?|\|\|)\s*Date\.now\(|(?:\?\?|\|\|)\s*Date\.now\(.+(?:AtUtcMs|dataAsOfUtcMs)/;
const LEGACY_TIME_TAIL_RE =
  /\?\?.*\b(capturedAtUtc|capturedAt(?!UtcMs\b)|dataTimestamp|publishedAt(?!UtcMs\b)|fetchedAt(?!UtcMs\b)|requestedAt(?!UtcMs\b)|completedAt(?!UtcMs\b)|firstSeenAt(?!UtcMs\b)|timestampValue|timestamp\b|savedAt(?!UtcMs\b)|createdAt(?!UtcMs\b)|date(?!UtcMs\b)\b)\b/;
const TS_SCALE_RE = /(?:utcMs|timestampUtcMs|capturedAtUtcMs|tsMs)\s*[*/]\s*1000(?!_)/;
const DATE_GETTERS_RE = /new\s+Date\([^)]*\)\s*\.get(?:Full)?(?:Year|Month|Date)\(/;
const HARDCODED_CHICAGO_RE = /["'`]America\/Chicago["'`]/;
const CT_DST_GUESSWORK_RE = /Date\.UTC\([\s\S]{0,240}getHourCT\([^)]+\)[\s\S]{0,240}-3_600_000/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, out);
      continue;
    }
    if (TEXT_FILE_EXTS.has(path.extname(entry.name))) out.push(abs);
  }
  return out;
}

function relative(absPath) {
  return path.relative(ROOT, absPath).replaceAll("\\", "/");
}

function push(absPath, lineNo, message) {
  failures.push(`${relative(absPath)}:${lineNo}: ${message}`);
}

function localeCallHasExplicitTimezone(lines, startIndex) {
  for (let i = startIndex; i < Math.min(lines.length, startIndex + 8); i += 1) {
    if (lines[i].includes("timeZone:")) return true;
    if (lines[i].includes(");")) break;
  }
  return false;
}

const targets = [SRC, path.join(ROOT, "scripts")];
for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  for (const absPath of walk(target)) {
    const relPath = path.relative(ROOT, absPath);
    if (path.normalize(relPath) === SELF_REL) continue;
    const text = fs.readFileSync(absPath, "utf8");
    const lines = text.split(/\r?\n/);
    const isMd = absPath.endsWith(".md");

    const ctGuessworkMatch = CT_DST_GUESSWORK_RE.exec(text);
    if (ctGuessworkMatch && !isMd) {
      const lineNo = text.slice(0, ctGuessworkMatch.index).split(/\r?\n/).length;
      push(
        absPath,
        lineNo,
        "Do not derive CT boundaries with UTC guesswork and hour re-checks; use explicit CT date-key conversion helpers",
      );
    }

    lines.forEach((line, index) => {
      const lineNo = index + 1;

      if (
        line.includes("toISOString().slice(0, 10)") ||
        line.includes('.split("T")[0]') ||
        line.includes(".split('T')[0]")
      ) {
        if (!isMd) {
          push(
            absPath,
            lineNo,
            "Do not derive business dates from ISO slicing; use canonical date-key helpers in shared/utils/time.ts",
          );
        }
      }

      if (
        (LOCALE_METHOD_RE.test(line) || DATE_LOCALE_STRING_RE.test(line)) &&
        !localeCallHasExplicitTimezone(lines, index) &&
        !isMd
      ) {
        push(
          absPath,
          lineNo,
          "Locale-based date/time formatting must pass an explicit timeZone or use canonical formatters",
        );
      }

      if (SENTINEL_DATE_RE.test(line) && !isMd) {
        push(absPath, lineNo, "Do not use sentinel business dates like 1970-01-01");
      }

      if (ZERO_TIME_FALLBACK_RE.test(line)) {
        push(absPath, lineNo, "Do not coerce missing time fields to 0");
      }

      if (DATE_NOW_FALLBACK_RE.test(line)) {
        push(absPath, lineNo, "Do not fall back to Date.now() for missing persisted timestamps");
      }

      if (LEGACY_TIME_TAIL_RE.test(line)) {
        push(absPath, lineNo, "Legacy time fields must not be used in live runtime paths");
      }

      if (TS_SCALE_RE.test(line)) {
        push(absPath, lineNo, "Do not scale *1000 or /1000 on timestamp fields in domain logic");
      }

      if (DATE_GETTERS_RE.test(line) && !line.includes("getUTC") && !isMd) {
        push(
          absPath,
          lineNo,
          "Do not use Date getters for business date keys; use canonical date-key helpers in shared/utils/time.ts",
        );
      }

      if (
        HARDCODED_CHICAGO_RE.test(line) &&
        !ALLOW_HARDCODED_CHICAGO.has(path.normalize(relPath)) &&
        !isMd
      ) {
        push(
          absPath,
          lineNo,
          "Do not hardcode 'America/Chicago' outside shared/utils/time.ts — import APP_TIMEZONE instead",
        );
      }
    });
  }
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  const out = new Set();
  for (const raw of fs.readFileSync(BASELINE_PATH, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    out.add(line);
  }
  return out;
}

failures.sort();

if (process.argv.includes("--write-baseline")) {
  const header = [
    "# Baseline of time-rule violations to grandfather. Each line is a full violation message.",
    "# This list may SHRINK over time. It must never grow.",
    "",
  ].join("\n");
  fs.writeFileSync(BASELINE_PATH, header + failures.join("\n") + "\n", "utf8");
  console.log(`wrote baseline with ${failures.length} entries`);
  process.exit(0);
}

const baseline = readBaseline();
const unexpected = failures.filter((f) => !baseline.has(f));

if (unexpected.length > 0) {
  console.error(`Time rule check FAILED: ${unexpected.length} new violation(s) not in baseline`);
  for (const failure of unexpected) console.error(`- ${failure}`);
  process.exit(1);
}

const stale = [...baseline].filter((b) => !failures.includes(b));
if (stale.length > 0) {
  console.warn(`Time rule check: ${stale.length} stale baseline entr(y/ies) — consider trimming with --write-baseline`);
  for (const s of stale) console.warn(`- ${s}`);
}

console.log(`Time rule check passed: ${failures.length}/${baseline.size} grandfathered violations`);
