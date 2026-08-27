#!/usr/bin/env node
/**
 * codex_install_hooks.js — install/merge the Codex CLI PreCompact(auto)
 * handoff hook without replacing unrelated Codex hooks.
 *
 * Usage:
 *   node scripts/codex_install_hooks.js [--project <path>] [--dry-run]
 *
 * User-level:
 *   ~/.codex/hooks.json
 *   ~/.codex/hooks/codex_handoff_hook.js
 *
 * Project-level:
 *   <project>/.codex/hooks.json
 *   <project>/.codex/hooks/codex_handoff_hook.js
 *
 * Codex will require review/trust for changed non-managed command hooks.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const projectIdx = args.indexOf("--project");
  if (projectIdx !== -1 && !args[projectIdx + 1]) {
    throw new Error("--project requires a path");
  }
  return {
    projectRoot: projectIdx !== -1 ? path.resolve(args[projectIdx + 1]) : null,
    dryRun: args.includes("--dry-run"),
  };
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch (e) {
    throw new Error(`Existing hooks.json at ${filePath} is not valid JSON: ${e.message}`);
  }
}

function alreadyPresent(entries, marker) {
  return (entries || []).some((entry) =>
    (entry.hooks || []).some((h) => (h.command || "").includes(marker))
  );
}

function addPreCompact(settings, command) {
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PreCompact) settings.hooks.PreCompact = [];
  if (alreadyPresent(settings.hooks.PreCompact, "codex_handoff_hook.js")) return false;

  settings.hooks.PreCompact.push({
    matcher: "^auto$",
    hooks: [{ type: "command", command }],
  });
  return true;
}

function main() {
  let opts;
  try { opts = parseArgs(); }
  catch (e) { console.error(e.message); process.exit(1); }

  const codexDir = opts.projectRoot
    ? path.join(opts.projectRoot, ".codex")
    : path.join(os.homedir(), ".codex");
  const hooksDir = path.join(codexDir, "hooks");
  const hooksJson = path.join(codexDir, "hooks.json");
  const scriptSrc = path.join(__dirname, "codex_handoff_hook.js");
  const scriptDest = path.join(hooksDir, "codex_handoff_hook.js");

  // Use an absolute command path so POSIX/Windows shell expansion is not
  // required for the installed hook definition.
  const command = `node ${JSON.stringify(scriptDest)}`;

  let config;
  try { config = loadJson(hooksJson); }
  catch (e) { console.error(e.message); process.exit(1); }

  const added = addPreCompact(config, command);

  console.log(`Target hooks file: ${hooksJson}`);
  console.log(`Target hook script: ${scriptDest}`);
  console.log(`PreCompact(auto) hook added: ${added}`);

  if (opts.dryRun) {
    console.log("\n--dry-run: no files were written.");
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  fs.mkdirSync(hooksDir, { recursive: true });

  if (fs.existsSync(hooksJson) && added) {
    const backup = `${hooksJson}.bak.${Date.now()}`;
    fs.copyFileSync(hooksJson, backup);
    console.log(`Backed up existing hooks.json to ${backup}`);
  }

  if (added || !fs.existsSync(hooksJson)) {
    fs.writeFileSync(hooksJson, JSON.stringify(config, null, 2) + "\n", "utf8");
    console.log(`Wrote ${hooksJson}`);
  }

  if (fs.existsSync(scriptSrc)) {
    fs.copyFileSync(scriptSrc, scriptDest);
    console.log(`Copied codex_handoff_hook.js to ${scriptDest}`);
  } else {
    console.error(`Missing source hook script: ${scriptSrc}`);
    process.exit(1);
  }

  console.log("\nInstallation complete.");
  console.log("Open /hooks in Codex CLI and review/trust the new command hook before relying on it.");
}

main();
