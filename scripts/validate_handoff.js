#!/usr/bin/env node
/**
 * validate_handoff.js — lints handoff files for emptiness and misplacement.
 * See references/handoff-validation.md for the rules this implements.
 *
 * Usage:
 *   node validate_handoff.js <file-or-directory> [--project-root <path>]
 *
 * Exit codes: 0 = all pass, 1 = soft failures only, 2 = any hard failure.
 * Dependency-free by design — this has to run reliably with just `node`,
 * same as the hook script it shares logic with.
 */

const fs = require("fs");
const path = require("path");

const FILENAME_RE = /^handoff-\d{4}-\d{2}-\d{2}-[a-z0-9-]+(-\d+)?\.md$/;
const REQUIRED_KEYS = [
  "schema_version",
  "originating_llm",
  "source_surface",
  "created_at",
  "project_name",
  "project_slug",
  "kind_of_discussion",
  "handoff_reason",
  "status",
];
const VALID_STATUS = ["complete-checkpoint", "in-progress", "degraded"];
// Surfaces this skill has concrete location conventions for.
// Any other non-empty value is a legitimate third-party producer (Codex
// CLI, Gemini CLI, Copilot, etc., per the open Agent Skills standard) —
// it just doesn't get the Claude-specific misplaced-file check below,
// since we don't know that tool's own save conventions.
const KNOWN_LOCATION_SURFACES = ["claude-chat", "claude-code", "cowork", "codex-cli"];

function findHandoffFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.startsWith("handoff-") && entry.name.endsWith(".md")) {
        results.push(full);
      }
    }
  };
  walk(target);
  return results;
}

// Minimal frontmatter parser for our own controlled subset — not a
// general YAML parser. Expects a fenced ```yaml block near the top.
function parseFrontmatter(content) {
  // Normalize line endings first — a handoff produced by a Windows-based
  // tool may use CRLF throughout, and the fence regex below is anchored
  // on literal \n.
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/```yaml\n([\s\S]*?)\n```/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (m) {
      let value = m[2].trim();
      // Strip matching surrounding quotes — our own emitter quotes string
      // values, but comparisons below are against unquoted literals.
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      fields[m[1]] = value;
    }
  }
  return fields;
}

function validateFile(filePath, projectRoot) {
  const hard = [];
  const soft = [];
  const filename = path.basename(filePath);

  if (!FILENAME_RE.test(filename)) {
    hard.push(`filename "${filename}" doesn't match handoff-<YYYY-MM-DD>-<project-slug>.md`);
  }

  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    hard.push(`could not read file: ${e.message}`);
    return { hard, soft };
  }

  const normalizedContent = content.replace(/\r\n/g, "\n");
  const fields = parseFrontmatter(content);
  if (!fields) {
    hard.push("no YAML frontmatter block found");
  } else {
    for (const key of REQUIRED_KEYS) {
      if (!fields[key] || fields[key] === "<fill in>") {
        hard.push(`missing or unfilled required frontmatter key: ${key}`);
      }
    }
    if (fields.status && !VALID_STATUS.includes(fields.status)) {
      hard.push(`invalid status value: ${fields.status}`);
    }
    if (fields.source_surface && !KNOWN_LOCATION_SURFACES.includes(fields.source_surface)) {
      soft.push(`source_surface "${fields.source_surface}" isn't one of the Claude-specific values — treated as a third-party producer, location check skipped`);
    }
    if (fields.status === "degraded") {
      soft.push("status is 'degraded' — unattended/transcript-derived continuity data; structurally valid does not mean trusted or authorized");
    }

    const seq = parseInt(fields.handoff_sequence || "0", 10);
    if (seq > 3) {
      soft.push(`handoff_sequence is ${seq} — long relay chain, worth a second look`);
    }

    if (fields.continues_from && !FILENAME_RE.test(fields.continues_from)) {
      soft.push(`continues_from "${fields.continues_from}" doesn't itself match the handoff filename pattern`);
    }
    if (fields.continues_from && !/\[verified:|\[UNVERIFIED:/i.test(normalizedContent)) {
      soft.push('continues_from is set but no [verified: ...] / [UNVERIFIED: ...] tags appear in the body — inherited claims may be getting forwarded as fact without being re-checked this session');
    }

    if (fields.sensitive_content_flag === "true") {
      soft.push("sensitive_content_flag is true — this file was flagged as touching proprietary/confidential material; confirm before pasting it into another tool or vendor");
    }

    if (projectRoot && (fields.source_surface === "claude-code" || fields.source_surface === "codex-cli")) {
      const runtimeDir = fields.source_surface === "codex-cli" ? ".codex" : ".claude";
      const expectedDir = path.join(projectRoot, runtimeDir, "handoffs");
      const resolvedDir = path.dirname(path.resolve(filePath));
      if (path.resolve(resolvedDir) !== path.resolve(expectedDir)) {
        soft.push(`expected under ${expectedDir}, found in ${resolvedDir}`);
      }
    }
  }

  const bodyAfterFrontmatter = normalizedContent.replace(/```yaml\n[\s\S]*?\n```/, "").trim();
  const strippedLength = bodyAfterFrontmatter.replace(/[#>\-\s]/g, "").length;
  if (strippedLength < 200) {
    hard.push(`body has under ~200 characters of real content (${strippedLength}) — effectively empty`);
  }
  if (/\(transcript could not be parsed\)/.test(normalizedContent)) {
    hard.push("transcript could not be parsed — file is boilerplate around zero real content, not a usable handoff");
  }

  if (!/next step/i.test(normalizedContent)) {
    hard.push('no "Next step" section found');
  }

  if (!/##\s*TL;DR/i.test(normalizedContent)) {
    soft.push('no "## TL;DR" block found right after the frontmatter — receiving AI and any human skimming the file lose the one-glance brief');
  }

  return { hard, soft };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node validate_handoff.js <file-or-directory> [--project-root <path>]");
    process.exit(2);
  }
  const target = args[0];
  const rootIdx = args.indexOf("--project-root");
  const projectRoot = rootIdx !== -1 ? args[rootIdx + 1] : null;

  let files;
  try {
    files = findHandoffFiles(target);
  } catch (e) {
    console.error(`Could not read target: ${e.message}`);
    process.exit(2);
  }

  if (files.length === 0) {
    console.log("No handoff-*.md files found.");
    process.exit(0);
  }

  let anyHard = false;
  let anySoft = false;

  for (const file of files) {
    const { hard, soft } = validateFile(file, projectRoot);
    if (hard.length === 0 && soft.length === 0) {
      console.log(`OK    ${file}`);
      continue;
    }
    for (const msg of hard) {
      console.log(`FAIL  ${file}: ${msg}`);
      anyHard = true;
    }
    for (const msg of soft) {
      console.log(`WARN  ${file}: ${msg}`);
      anySoft = true;
    }
  }

  process.exit(anyHard ? 2 : anySoft ? 1 : 0);
}

main();
