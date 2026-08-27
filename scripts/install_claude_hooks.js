#!/usr/bin/env node
/**
 * install_claude_hooks.js — safely merges this skill's Stop/PreCompact hooks into
 * an existing ~/.claude/settings.json (or a project one, with --project),
 * without touching anything else already in that file.
 *
 * Usage:
 *   node install_claude_hooks.js [--project <path>] [--dry-run]
 *
 * What it does:
 *   1. Copies handoff_hook.js next to this script's install location
 *      (~/.claude/hooks/handoff_hook.js), if not already there.
 *   2. Locates the target settings.json (creating an empty {} if it
 *      doesn't exist yet).
 *   3. Backs up the existing file to settings.json.bak.<timestamp> before
 *      writing anything, if it already existed.
 *   4. Appends the handoff Stop/PreCompact hook entries — only if an
 *      entry referencing handoff_hook.js isn't already present, so
 *      running this twice doesn't duplicate hooks.
 *   5. Leaves every other key in settings.json (model prefs, permissions,
 *      other hooks, etc.) completely untouched.
 *
 * --dry-run prints what would change without writing anything.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const projectIdx = args.indexOf("--project");
  return {
    projectRoot: projectIdx !== -1 ? args[projectIdx + 1] : null,
    dryRun: args.includes("--dry-run"),
    forceWindows: args.includes("--windows"),
    forcePosix: args.includes("--posix"),
  };
}

function loadSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch (e) {
    throw new Error(
      `Existing settings.json at ${settingsPath} isn't valid JSON — fix or ` +
      `remove it before running this installer. Parse error: ${e.message}`
    );
  }
}

function hookAlreadyPresent(hookList, marker) {
  return (hookList || []).some((entry) =>
    (entry.hooks || []).some((h) => (h.command || "").includes(marker))
  );
}

function addHookEntry(settings, eventName, commandString, marker) {
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks[eventName]) settings.hooks[eventName] = [];

  if (hookAlreadyPresent(settings.hooks[eventName], marker)) {
    return false; // already installed, nothing to do
  }

  settings.hooks[eventName].push({
    matcher: ".*",
    hooks: [{ type: "command", command: commandString }],
  });
  return true;
}

function main() {
  const { projectRoot, dryRun, forceWindows, forcePosix } = parseArgs();
  const isWindows = forceWindows ? true : forcePosix ? false : os.platform() === "win32";
  const marker = "handoff_hook.js";

  const claudeDir = projectRoot
    ? path.join(projectRoot, ".claude")
    : path.join(os.homedir(), ".claude");
  const hooksDir = path.join(claudeDir, "hooks");
  const settingsPath = path.join(claudeDir, "settings.json");
  const scriptSrc = path.join(__dirname, "handoff_hook.js");
  const scriptDest = path.join(hooksDir, "handoff_hook.js");

  console.log(`Target settings file: ${settingsPath}`);
  console.log(`Target hook script:   ${scriptDest}`);

  let settings;
  try {
    settings = loadSettings(settingsPath);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const stopCommand = isWindows
    ? '$env:HANDOFF_TOKEN_THRESHOLD=150000; node "$env:USERPROFILE\\.claude\\hooks\\handoff_hook.js"'
    : "HANDOFF_TOKEN_THRESHOLD=150000 node ~/.claude/hooks/handoff_hook.js";
  const precompactCommand = isWindows
    ? 'node "$env:USERPROFILE\\.claude\\hooks\\handoff_hook.js"'
    : "node ~/.claude/hooks/handoff_hook.js";

  const addedStop = addHookEntry(settings, "Stop", stopCommand, marker);
  const addedPrecompact = addHookEntry(settings, "PreCompact", precompactCommand, marker);

  if (!addedStop && !addedPrecompact) {
    console.log("Handoff hooks already present in settings.json — nothing to change.");
  } else {
    console.log(`Would add: Stop hook = ${addedStop}, PreCompact hook = ${addedPrecompact}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no files were written.");
    console.log("Resulting settings.json would be:\n");
    console.log(JSON.stringify(settings, null, 2));
    return;
  }

  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(hooksDir, { recursive: true });

  if (addedStop || addedPrecompact) {
    if (fs.existsSync(settingsPath)) {
      const backupPath = `${settingsPath}.bak.${Date.now()}`;
      fs.copyFileSync(settingsPath, backupPath);
      console.log(`Backed up existing settings.json to ${backupPath}`);
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
    console.log(`Wrote ${settingsPath}`);
  }

  if ((addedStop || addedPrecompact) && fs.existsSync(scriptSrc)) {
    fs.copyFileSync(scriptSrc, scriptDest);
    console.log(`Copied handoff_hook.js to ${scriptDest}`);
  } else if (addedStop || addedPrecompact) {
    console.log(
      `Warning: ${scriptSrc} not found next to this installer — copy ` +
      `handoff_hook.js to ${scriptDest} manually.`
    );
  }

  console.log("\nDone. Run with --dry-run first next time if you want to preview before writing.");
}

main();
