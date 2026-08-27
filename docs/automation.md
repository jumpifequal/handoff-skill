# Manual and Automatic Handoff Behaviour

Handoff separates the portable protocol from runtime-specific automation.

## Portable baseline

The universal mechanism is always manual:

```text
handoff
```

or:

```text
/handoff
```

This does not depend on lifecycle hooks, context telemetry or a particular vendor.

## Surface matrix

| Surface | Manual | Automatic | Notes |
|---|---:|---:|---|
| ChatGPT / OpenAI chat surfaces | ✅ | — | File creation depends on the active surface. |
| Codex CLI | ✅ | ✅ | Uses `PreCompact`. |
| Claude.ai / Claude app | ✅ | — | No lifecycle hook is assumed by this skill. |
| Claude Code | ✅ | ✅ | Uses `PreCompact` / `Stop` integration. |
| Claude Cowork | ✅ | — | Manual workflow only. |

## Why automatic files are marked degraded

An automatic lifecycle hook is a last-chance safety mechanism.

It may operate without a model carefully curating the state, so the output is intentionally labelled:

```yaml
status: degraded
```

That label protects the receiving AI from assuming that an emergency transcript-derived checkpoint has the same quality as a manually generated handoff.

## Codex CLI

Installer:

```bash
node scripts/codex_install_hooks.js --dry-run
node scripts/codex_install_hooks.js
```

Project-local:

```bash
node scripts/codex_install_hooks.js --dry-run --project /path/to/project
node scripts/codex_install_hooks.js --project /path/to/project
```

The hook listens for the native `PreCompact` event rather than trying to estimate context usage itself.

See `references/codex-cli-hook-setup.md` for the complete contract.

## Claude Code

Installer:

```bash
node scripts/claude_install_hooks.js --dry-run
node scripts/claude_install_hooks.js
```

Project-local:

```bash
node scripts/claude_install_hooks.js --dry-run --project /path/to/project
node scripts/claude_install_hooks.js --project /path/to/project
```

The Node implementation avoids making Bash a hard portability assumption.

See `references/claude-code-hook-setup.md` for details.

## Security properties

The installers are designed to:

- preserve unrelated hook configuration;
- support dry-run inspection before writes;
- avoid implying that a hook is active merely because the skill is installed;
- keep runtime-specific automation separate from the vendor-neutral handoff format.

## Operational recommendation

Use manual handoff for high-value checkpoints.

Treat automatic hooks as a recovery layer for context-compaction or session-boundary risk.
