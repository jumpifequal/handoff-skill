#!/usr/bin/env node
/**
 * handoff_hook.js — cross-platform fallback safety-net handoff writer for
 * Claude Code (macOS, Linux, and Windows — native w/ Git Bash, WSL, or
 * PowerShell-invoked).
 *
 * Why Node instead of bash: the JSON payload parsing already required
 * Node, and Node is a single dependency that behaves identically regardless
 * of which shell Claude Code used to launch this process (bash, PowerShell,
 * or cmd) — the shell only has to be able to run `node <path>`, nothing
 * shell-specific happens after that. Requires `node` on PATH in that shell;
 * see references/claude-code-hook-setup.md for what that assumption does
 * and doesn't cover.
 *
 * This is a raw-dump fallback, not the curated handoff the skill produces
 * conversationally. It exists so nothing is lost if the manual "/handoff"
 * trigger is missed before compaction/session end.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const TOKEN_THRESHOLD = parseInt(process.env.HANDOFF_TOKEN_THRESHOLD || "150000", 10);

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch (e) {
    return "";
  }
}

function safeExit0() {
  process.exit(0);
}

function slugify(name) {
  return (name || "unknown-project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown-project";
}


function hardenFilePermissions(filePath) {
  try {
    // POSIX: owner read/write only. Windows ignores POSIX chmod semantics safely.
    fs.chmodSync(filePath, 0o600);
  } catch (_) {}
}

function uniqueFilename(dir, baseName) {
  // baseName is without extension, e.g. "handoff-2026-07-23-my-project"
  let candidate = `${baseName}.md`;
  let n = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    n += 1;
    candidate = `${baseName}-${n}.md`;
  }
  return candidate;
}

function main() {
  const raw = readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    return safeExit0();
  }

  const hookEvent = payload.hook_event_name || "";
  const transcriptPath = payload.transcript_path || "";
  const cwd = payload.cwd || "";

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return safeExit0();
  }

  let stat;
  try {
    stat = fs.statSync(transcriptPath);
  } catch (e) {
    return safeExit0();
  }

  const approxTokens = Math.floor(stat.size / 4);
  const shouldWrite = hookEvent === "PreCompact" || approxTokens >= TOKEN_THRESHOLD;
  if (!shouldWrite) {
    return safeExit0();
  }

  let lines = [];
  try {
    lines = fs.readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  } catch (e) {
    return safeExit0();
  }

  const turns = [];
  for (const line of lines) {
    try {
      const j = JSON.parse(line);
      const role = (j.message && j.message.role) || j.role;
      const content = (j.message && j.message.content) || j.content;
      if (!role || !content) continue;
      const text = Array.isArray(content)
        ? content.map((c) => c.text || "").filter(Boolean).join(" ")
        : String(content);
      if (text.trim()) turns.push(`[${role}] ${text}`);
    } catch (e) {
      // skip malformed lines
    }
  }

  const nowIso = new Date().toISOString();
  const dateOnly = nowIso.slice(0, 10);

  // Prefer the project directory — `cwd` is a guaranteed field on every
  // hook payload, and a handoff about *this* work belongs next to the
  // work, not on the Desktop. `.claude/handoffs/` keeps it out of the way
  // of the actual project tree while staying inside it. Desktop is a
  // fallback only, for the case where `cwd` is missing or unwritable.
  const projectName = cwd ? path.basename(cwd) : "unknown-project";
  const projectSlug = slugify(projectName);

  let outDir;
  if (cwd && fs.existsSync(cwd)) {
    outDir = path.join(cwd, ".claude", "handoffs");
  } else {
    outDir = path.join(os.homedir(), "Desktop");
  }
  try {
    fs.mkdirSync(outDir, { recursive: true });
    if (cwd && outDir === path.join(cwd, ".claude", "handoffs")) {
      const gitignorePath = path.join(outDir, ".gitignore");
      if (!fs.existsSync(gitignorePath)) {
        // Raw transcript dumps can contain anything pasted during the
        // session, including secrets — don't let this become a
        // `git add .` accident.
        fs.writeFileSync(gitignorePath, "*\n", "utf8");
      }
    }
  } catch (e) {
    // Project dir wasn't writable — fall back to Desktop, then homedir.
    outDir = path.join(os.homedir(), "Desktop");
    try {
      fs.mkdirSync(outDir, { recursive: true });
    } catch (e2) {
      outDir = os.homedir();
    }
  }

  const handoffReason = hookEvent === "PreCompact" ? "context-compaction" : "checkpoint";

  const frontmatter = [
    "```yaml",
    'schema_version: "1.0"',
    'originating_llm: "Claude Code (automated fallback hook, unverified)"',
    'source_surface: "claude-code"',
    `created_at: "${nowIso}"`,
    `project_name: "${projectName}"`,
    `project_slug: "${projectSlug}"`,
    'kind_of_discussion: "unknown"',
    `handoff_reason: "${handoffReason}"`,
    'status: "degraded"\nsensitive_content_flag: true',
    "```",
  ].join("\n");

  const body = [
    frontmatter,
    "",
    `# Auto-saved handoff draft (${hookEvent || "unknown trigger"}, ~${approxTokens} tokens)`,
    "",
    '> Raw safety-net dump — unpolished, unattended, `status: degraded`.',
    '> Prefer running "/handoff" in-session when possible; this exists only',
    "> to avoid total loss.",
    "",
    "## Next step",
    "",
    "This is an unattended fallback dump — the hook cannot infer intent.",
    "Review the raw transcript below and determine the actual next step",
    "manually before continuing the work.",
    "",
    "## Raw transcript",
    "",
    "```",
    turns.length ? turns.join("\n") : "(transcript could not be parsed)",
    "```",
    "",
  ].join("\n");

  const filename = uniqueFilename(outDir, `handoff-${dateOnly}-${projectSlug}`);
  const outFile = path.join(outDir, filename);
  try {
    fs.writeFileSync(outFile, body, "utf8");
  } catch (e) {
    return safeExit0();
  }

  selfValidate(outFile);
  safeExit0();
}

function selfValidate(filePath) {
  // Best-effort, non-blocking: run the shared validator against the file
  // we just wrote and log any hard failures to stderr. Never lets a
  // validation problem stop the handoff itself from being written.
  try {
    const validatorPath = path.join(__dirname, "validate_handoff.js");
    if (!fs.existsSync(validatorPath)) return;
    const result = spawnSync("node", [validatorPath, filePath], {
      encoding: "utf8",
      timeout: 3000,
    });
    if (result.status === 2 && result.stdout) {
      process.stderr.write(`handoff_hook: self-check found issues in ${filePath}:\n${result.stdout}`);
    }
  } catch (e) {
    // Validator not runnable for some reason — don't block the hook over it.
  }
}


main();
