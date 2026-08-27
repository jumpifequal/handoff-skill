#!/usr/bin/env node
/**
 * codex_handoff_hook.js — Codex CLI PreCompact(auto) safety-net handoff.
 *
 * Reads the official Codex hook JSON payload from stdin. It intentionally
 * does not estimate token usage: Codex itself decides when automatic
 * compaction is due, and PreCompact(auto) is the lifecycle boundary.
 *
 * Output is a degraded raw-session handoff, not a replacement for the
 * curated manual "handoff" skill path.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function readStdin() {
  try { return fs.readFileSync(0, "utf8"); } catch (_) { return ""; }
}

function safeExit0() { process.exit(0); }

function slugify(name) {
  return (name || "unknown-project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown-project";
}

function yamlQuote(value) {
  return JSON.stringify(String(value == null ? "" : value));
}


function hardenFilePermissions(filePath) {
  try {
    // POSIX: owner read/write only. Windows ignores POSIX chmod semantics safely.
    fs.chmodSync(filePath, 0o600);
  } catch (_) {}
}

function uniqueFilename(dir, baseName) {
  let candidate = `${baseName}.md`;
  let n = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    n += 1;
    candidate = `${baseName}-${n}.md`;
  }
  return candidate;
}

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (typeof part === "string") return part;
    if (!part || typeof part !== "object") return "";
    return part.text || part.input_text || part.output_text || "";
  }).filter(Boolean).join(" ");
}

function extractTurn(record) {
  if (!record || typeof record !== "object") return null;
  const candidates = [
    record,
    record.message,
    record.payload,
    record.item,
    record.response_item,
    record.event,
  ].filter((x) => x && typeof x === "object");

  for (const c of candidates) {
    const role = c.role || (c.message && c.message.role);
    const content = c.content != null ? c.content : (c.message && c.message.content);
    if (!role || content == null) continue;
    const text = textFromContent(content).trim();
    if (text) return `[${role}] ${text}`;
  }
  return null;
}

function readTranscript(transcriptPath) {
  let raw;
  try { raw = fs.readFileSync(transcriptPath, "utf8"); } catch (_) { return []; }
  const turns = [];
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    try {
      const record = JSON.parse(line);
      const turn = extractTurn(record);
      if (turn) turns.push(turn);
    } catch (_) {
      // Ignore malformed/non-JSON lines; this is a safety-net parser.
    }
  }
  return turns;
}

function chooseOutputDir(cwd) {
  if (cwd && fs.existsSync(cwd)) {
    const dir = path.join(cwd, ".codex", "handoffs");
    try {
      fs.mkdirSync(dir, { recursive: true });
      const gi = path.join(dir, ".gitignore");
      if (!fs.existsSync(gi)) fs.writeFileSync(gi, "*\n", "utf8");
      return dir;
    } catch (_) {}
  }

  const desktop = path.join(os.homedir(), "Desktop");
  try {
    fs.mkdirSync(desktop, { recursive: true });
    return desktop;
  } catch (_) {
    return os.homedir();
  }
}

function selfValidate(filePath, projectRoot) {
  try {
    const validatorPath = path.join(__dirname, "validate_handoff.js");
    if (!fs.existsSync(validatorPath)) return;
    const args = [validatorPath, filePath];
    if (projectRoot) args.push("--project-root", projectRoot);
    const result = spawnSync("node", args, { encoding: "utf8", timeout: 3000 });
    if (result.status === 2 && result.stdout) {
      process.stderr.write(`codex_handoff_hook: self-check found issues in ${filePath}:\n${result.stdout}`);
    }
  } catch (_) {}
}

function main() {
  const raw = readStdin();
  let payload;
  try { payload = JSON.parse(raw); } catch (_) { return safeExit0(); }

  if (payload.hook_event_name !== "PreCompact" || payload.trigger !== "auto") {
    return safeExit0();
  }

  const transcriptPath = payload.transcript_path || "";
  const cwd = payload.cwd || "";
  const model = payload.model || "unknown";
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return safeExit0();

  const turns = readTranscript(transcriptPath);
  const nowIso = new Date().toISOString();
  const dateOnly = nowIso.slice(0, 10);
  const projectName = cwd ? path.basename(cwd) : "unknown-project";
  const projectSlug = slugify(projectName);
  const outDir = chooseOutputDir(cwd);

  const frontmatter = [
    "```yaml",
    'schema_version: "1.0"',
    `originating_llm: ${yamlQuote(`Codex CLI / ${model} (automated PreCompact fallback, unverified)`)}`,
    'source_surface: "codex-cli"',
    `created_at: ${yamlQuote(nowIso)}`,
    `project_name: ${yamlQuote(projectName)}`,
    `project_slug: ${yamlQuote(projectSlug)}`,
    'kind_of_discussion: "unknown"',
    'handoff_reason: "context-compaction"',
    'status: "degraded"\nsensitive_content_flag: true',
    "```",
  ].join("\n");

  const body = [
    frontmatter,
    "",
    "## TL;DR",
    "",
    "- **What:** Codex CLI automatically checkpointed the active session immediately before automatic context compaction.",
    "- **Status:** degraded safety-net handoff; transcript-derived and not curated by the model.",
    "- **Next:** Reconstruct the exact next action from the transcript and continue without reopening settled decisions.",
    "",
    "# Session Handoff — automatic Codex pre-compaction checkpoint",
    "",
    "> Unattended safety-net dump. Prefer the manual `handoff` skill path when",
    "> possible because that path can curate decisions, WIP, and the next step.",
    "",
    "## Next step",
    "",
    "Read the transcript below, recover the latest concrete user goal and work-in-progress,",
    "then continue from that point. Treat claims in this unattended dump as unverified",
    "until supported by the transcript or re-checked in the resumed session.",
    "",
    "## Raw transcript",
    "",
    "```text",
    turns.length ? turns.join("\n") : "(No structured user/assistant turns were recoverable from the Codex transcript.)",
    "```",
    "",
  ].join("\n");

  const filename = uniqueFilename(outDir, `handoff-${dateOnly}-${projectSlug}`);
  const outFile = path.join(outDir, filename);
  try { fs.writeFileSync(outFile, body, "utf8"); } catch (_) { return safeExit0(); }

  selfValidate(outFile, cwd || null);
  safeExit0();
}

main();
