#!/usr/bin/env node
// Code hygiene verifier — checks export freeze, console.log, and naming rules.
// Run: node scripts/check-hygiene-rules.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

const warnings = [];
const errors = [];

const TS_EXTS = new Set([".ts", ".tsx"]);
const IGNORE_DIRS = new Set(["node_modules", ".dist", "dist", ".git"]);

// Files where raw console.log is allowed (log infrastructure).
const CONSOLE_EXCEPTION_ZONES = new Set([
  path.normalize("src/shared/log/devTools.ts"),
  path.normalize("src/shared/log/core/LogService.ts"),
]);

// Frozen legacy *_renderPage exports — page entry points that pre-date the
// camelCase rule. Do not add new ones.
const FROZEN_RENDER_PAGE_EXPORTS = new Set([
  "holdings_renderPage",
  "riskManagement_renderPage",
  "options_renderPage",
  "optionFlow_renderPage",
  "aiAnalysis_renderPage",
  "news_renderPage",
  "analysisVisualize_renderPage",
  "optionFlowSettings_renderPage",
]);

// Existing ui_* exports — grandfathered. New ui_* exports trigger a warning.
const FROZEN_UI_EXPORTS = new Set([
  "ui_createElement",
  "ui_createMain",
  "ui_collapsible",
  "ui_statusDot",
  "ui_formRow",
  "ui_badge",
  "ui_makeDraggable",
  "ui_toggleMinimize",
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, out);
      continue;
    }
    if (TS_EXTS.has(path.extname(entry.name))) out.push(abs);
  }
  return out;
}

function relative(absPath) {
  return path.relative(ROOT, absPath).replaceAll("\\", "/");
}

const SRC = path.join(ROOT, "src");
for (const absPath of walk(SRC)) {
  const relPath = path.relative(ROOT, absPath);
  const normalizedRel = path.normalize(relPath);
  const text = fs.readFileSync(absPath, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    if (
      /\bconsole\.log\b/.test(line) &&
      !CONSOLE_EXCEPTION_ZONES.has(normalizedRel)
    ) {
      errors.push(
        `${relative(absPath)}:${lineNo}: Raw console.log in active code — use the log service instead`,
      );
    }

    const renderPageMatch = line.match(/export\s+function\s+(\w+_renderPage)\b/);
    if (renderPageMatch && !FROZEN_RENDER_PAGE_EXPORTS.has(renderPageMatch[1])) {
      errors.push(
        `${relative(absPath)}:${lineNo}: New *_renderPage export '${renderPageMatch[1]}' — frozen legacy pattern, use camelCase`,
      );
    }

    const uiExportMatch = line.match(/export\s+(?:function|const|class)\s+(ui_\w+)\b/);
    if (uiExportMatch && !FROZEN_UI_EXPORTS.has(uiExportMatch[1])) {
      errors.push(
        `${relative(absPath)}:${lineNo}: New ui_* export '${uiExportMatch[1]}' — frozen legacy pattern, use camelCase`,
      );
    }
  });
}

if (warnings.length > 0) {
  console.warn("Hygiene warnings (report-only):");
  for (const w of warnings) console.warn(`  - ${w}`);
}

if (errors.length > 0) {
  console.error("Hygiene violations (blocking):");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

if (warnings.length === 0 && errors.length === 0) {
  console.log("Hygiene check passed.");
} else {
  console.log(`Hygiene check: ${errors.length} errors, ${warnings.length} warnings.`);
}
