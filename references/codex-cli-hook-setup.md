# Codex CLI automatic handoff setup

## What this integration does

Codex CLI has a first-party `PreCompact` lifecycle event. The package registers
one command hook for:

- event: `PreCompact`
- matcher: `^auto$`
- action: run `codex_handoff_hook.js`

This means the handoff is written immediately before **automatic** context
compaction. It does not depend on polling transcript size or approximating
tokens.

The hook receives the Codex JSON payload on stdin and uses the documented
`transcript_path`, `cwd`, `model`, `hook_event_name`, and `trigger` fields.
The generated file is written under `<project>/.codex/handoffs/` when
possible and is marked `status: degraded` because it is an unattended
transcript-derived safety net rather than a curated model-authored handoff.

## Install

From the unpacked skill directory:

`node scripts/install_codex_hooks.js`

Useful options:

- `--dry-run` — print the merged `hooks.json` without writing anything.
- `--project <path>` — install into `<path>/.codex/` instead of the user
  scope under `~/.codex/`.

The installer:

1. loads the existing `hooks.json` if present;
2. preserves all unrelated hooks;
3. appends one `PreCompact` matcher for `^auto$` if this hook is not already
   present;
4. backs up an existing file before changing it;
5. copies `codex_handoff_hook.js` into the matching `.codex/hooks/` folder.

After installation, open `/hooks` in Codex CLI and review/trust the hook.
Codex does not run changed non-managed command hooks until their exact
definition has been trusted.

## Manual configuration

Equivalent `hooks.json` shape:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "^auto$",
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/.codex/hooks/codex_handoff_hook.js"
          }
        ]
      }
    ]
  }
}
```

Codex discovers hooks at user and project config layers, including:

- `~/.codex/hooks.json`
- `<repo>/.codex/hooks.json`

Project-local hooks require the project layer to be trusted.

## The 90% boundary

The hook itself does not decide when 90% has been reached. It deliberately
uses Codex's own automatic-compaction event as the trigger.

Codex exposes:

- `model_context_window` — active model context-window tokens;
- `model_auto_compact_token_limit` — token threshold that triggers automatic
  history compaction;
- `model_auto_compact_token_limit_scope` — whether the threshold counts the
  total active context or only growth after the carried prefix.

If `model_auto_compact_token_limit` is unset, Codex uses the model default.
To require a literal 90% threshold, set the threshold to:

`floor(model_context_window * 0.90)`

Example only, for a model/context configuration explicitly known to be
200,000 tokens:

```toml
model_context_window = 200000
model_auto_compact_token_limit = 180000
model_auto_compact_token_limit_scope = "total"
```

Do not copy that numeric example for a different model. Prefer the active
model's actual context-window value.

## Runtime behavior and limitations

- The matcher is `^auto$`; manual compaction does not trigger this hook.
  Change the matcher to `manual|auto` only if you want both.
- `PreCompact` can return `continue: false` to stop before compaction, but
  this package intentionally does not block compaction. The goal is to save
  state, then let Codex proceed normally.
- The transcript format is treated defensively. The hook extracts common
  user/assistant message shapes and silently skips unknown records.
- If no structured turns can be recovered, the hook still writes an honest
  degraded checkpoint rather than inventing missing conversation content.
- The file is a fallback. A manual `handoff` invocation remains superior
  because the model can curate decisions, rejected paths, current WIP, and
  a precise next step.

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
