# Claude Code auto-handoff: what's actually possible today

## What does and doesn't exist

This entire hook mechanism is **Claude Code only**. Cowork does not
currently run Claude Code's hook lifecycle — `~/.claude/settings.json`
hooks are not honored there (open, unresolved upstream feature request,
not a shipped capability). Installing `claude_handoff_hook.js` in a Cowork
environment does nothing; on Cowork, and on claude.ai chat/app, the manual
"handoff" / "/handoff" trigger is the entire mechanism.

Within Claude Code specifically, does **not** currently expose:
- your Claude.ai / API usage-limit percentage to hooks, or
- an exact context-window percentage to hook scripts.

Both are open upstream feature requests. Don't build on an assumption that
usage % or window size is available in the hook environment — it isn't yet.

What *does* exist and is reliable:

| Hook | Fires when | Use for |
|---|---|---|
| `PreCompact` | Right before Claude Code auto-compacts context (near the context-window ceiling) | Guaranteed last-chance save. Notification-only — cannot block compaction. |
| `Stop` | End of each agent turn | Cheap place to check transcript size against your own threshold and fire an earlier warning. |

So "trigger at 90%" for Claude Code means **90% of the context window**,
approximated from transcript size — not 90% of your message/rate quota.
There's no hook surface for the rate-limit case at all today.

## Cross-platform support

The hook logic is a single Node.js file (`claude_handoff_hook.js`), not a shell
script. That was a deliberate fix, not the original design: the first
version was bash, and bash is not a safe assumption on Windows. Specifically:

- If Git for Windows is **not** installed, Claude Code uses **PowerShell**
  as the hook shell, which cannot execute a `#!/usr/bin/env bash` script at
  all.
- If Git for Windows **is** installed, there's an open, real bug
  (`anthropics/claude-code#37634`, `#26006`) where `bash` on Windows can
  silently resolve to a WSL stub instead of Git Bash, depending on install
  method and PATH ordering — which breaks tool availability inside the
  script and has caused hooks to hang.
- Even ignoring both of those, the original script depended on `wc`,
  `sed`, `pbcopy`/`xclip` — none of which exist on native Windows.

Node was already a hard dependency (it was doing the JSON parsing in the
bash version), so moving *all* the logic into Node removes the shell
dependency instead of trying to branch bash-vs-PowerShell syntax inside one
script. The shell (bash, PowerShell, or cmd) only has to be able to run
`node <path>` — everything after that is identical Node code on every OS.
Clipboard access is the one place that's still genuinely OS-specific, and
that branch lives inside the Node script itself (`os.platform()` →
`pbcopy` / `clip` / `xclip`→`xsel`→`wl-copy`), not in the hook config.

**This does not eliminate the Windows shell-resolution risk above** — if
Claude Code can't find a working shell to launch `node` from in the first
place, no amount of adapter code inside the script fixes that. That's an
environment/install-method issue on your machine, not something this skill
can patch around. `claude doctor` (mentioned in Claude Code's own docs) is
the right tool to confirm which shell Claude Code is actually using before
you debug this hook.

## Setup

**Recommended: run the installer.** From inside the unzipped skill folder
(or pointing at wherever you extracted it):

```
node scripts/claude_install_hooks.js
```

This copies `claude_handoff_hook.js` to `~/.claude/hooks/`, merges only the
`Stop`/`PreCompact` hook entries into `~/.claude/settings.json`, and
leaves every other key in that file (model preferences, permissions,
other hooks) untouched. It backs up the existing file first if one
exists, and running it again later is safe — it detects the hooks are
already present and does nothing rather than duplicating them.

- `--dry-run` — prints exactly what would change without writing
  anything. Worth running once first if you want to see the result before
  it touches your real settings file.
- `--project <path>` — targets `<path>/.claude/settings.json` (a
  project-local config) instead of the global `~/.claude/settings.json`.
- It auto-detects Windows vs. POSIX and writes the matching command syntax
  (`$env:USERPROFILE\...` vs. `~/...`) — you don't need to pick between
  the two settings snippets manually if you use the installer.

**Manual alternative**, if you'd rather see exactly what's being added or
don't want to run a script against your settings file:

1. Copy `scripts/claude_handoff_hook.js` to `~/.claude/hooks/claude_handoff_hook.js`
   (same relative path on Windows: `%USERPROFILE%\.claude\hooks\claude_handoff_hook.js`).
   No `chmod +x` needed — it's invoked as `node <path>`, not executed
   directly.
2. Open `~/.claude/settings.json` in a text editor. If it doesn't exist,
   create it with just the contents of the matching snippet below. If it
   already exists, add a `"hooks"` key if there isn't one, and inside it
   add `"Stop"` and `"PreCompact"` arrays — if those already exist (from
   another tool), append a new entry to the array rather than replacing
   it, so the other tool's hook keeps working alongside this one.
   - `scripts/settings.snippet.posix.json` — macOS, Linux, WSL, or Windows
     with Git Bash correctly resolving.
   - `scripts/settings.snippet.windows-powershell.json` — native Windows
     without Git for Windows installed.
   If you're not sure which applies, run `claude doctor` first.
3. Adjust `HANDOFF_TOKEN_THRESHOLD` — it's a raw token count (e.g. `150000`
   for a 200K window at ~75%), not a percentage, since the hook environment
   doesn't expose window size either. Raise it if you've been upgraded to a
   larger context window.
4. Confirm `node` is on PATH in whichever shell Claude Code is actually
   using for hooks — if you installed Claude Code via the native binary
   installer without a separate Node.js install, this is not guaranteed.
   `node --version` in that same shell is the check.

## What the script does

- On `Stop`: reads the current transcript, estimates tokens (bytes / 4 —
  intentionally approximate, not a real tokenizer), and if past
  `HANDOFF_TOKEN_THRESHOLD`, writes a handoff draft to
  `<project-dir>/.claude/handoffs/handoff-<timestamp>.md` (using the `cwd`
  field Claude Code guarantees on every hook payload) and attempts a
  clipboard copy. Falls back to `<home>/Desktop`, then the home directory
  itself, only if the project directory isn't available or writable.
- The first write into a project creates `.claude/handoffs/.gitignore`
  (containing `*`) so raw transcript dumps — which can contain anything
  that was pasted during the session, including secrets — don't end up in
  a commit by accident. It's created once and left alone on later runs.
- On `PreCompact`: always writes a draft, regardless of threshold, as the
  last-resort catch-all.
- The draft is a raw dump of the transcript's user/assistant turns, not the
  curated file this skill writes conversationally. Treat it as a safety
  net, not a substitute for running "/handoff" yourself when you notice the
  warning — a model-generated handoff is better organized than what a
  script can produce from a JSON transcript.
- Every failure mode (missing fields, unreadable transcript, malformed
  JSON, no clipboard utility present, empty stdin) degrades to a silent
  no-op — it will never crash the hook pipeline or print noise into your
  session.

## Security and privacy characteristics

Automatic checkpoints intentionally preserve the **complete available transcript**
because their primary purpose is lossless session continuity. This is a deliberate
trade-off, not a hidden behavior.

Controls:
- handoff directories remain git-ignored;
- generated checkpoint files are hardened to owner read/write (`0600`) where the
  host filesystem supports POSIX permissions;
- automatic handoffs set `status: degraded` and `sensitive_content_flag: true`;
- imported checkpoint content is untrusted continuity data and cannot override the
  receiving agent's higher-priority instructions or permission model;
- the Claude hook does not copy the transcript/handoff to the system clipboard.

Operators should protect `.claude/handoffs/` or `.codex/handoffs/` as sensitive local
data and apply their normal retention/deletion policy after continuity is restored.
