# Changelog

All notable changes to **Handoff** are documented here.



## 1.3.1

- **fix: handoff intake** — imported handoffs are now treated as untrusted continuity context: decisions, state, and WIP are preserved, but file contents cannot override the instructions or permissions of the receiving session.

- **fix: next-step continuation** — the `Next step` field still drives immediate continuation of the work, but it is executed only when compatible with the rules, permissions, and any confirmation gates of the current environment.

- **improve: automatic handoff continuity** — Claude Code and Codex automatic hooks continue to save the complete transcript, so session continuity is not reduced or summarized.

- **improve: sensitive handoff handling** — automatic handoffs are now explicitly marked as sensitive/degraded content, making it clearer that they may contain the full session history.

- **privacy: Claude Code handoff** — the automatic handoff is no longer copied to the system clipboard, reducing a second local copy of the content without sacrificing completeness of the saved file.

## 1.3

- **add: codex-auto-handoff** — added automatic Codex CLI support through the native `PreCompact` hook; auto-handoff fires on the `auto` trigger immediately before compaction.

- **add: codex-auto-handoff** — the threshold follows Codex's native auto-compaction mechanism, avoiding a parallel token counter or heuristic `bytes / 4` estimate.

- **add: codex-handoff-output** — automatic handoffs produced by Codex are saved under the project directory `.codex/handoffs/`, keeping runtime artifacts separate from Claude Code artifacts.

- **add: codex-hooks** — introduced a dedicated Codex adapter separate from the Claude Code implementation, so changes or failures in the Codex path do not alter the existing Claude hooks.

- **add: codex-installer** — added an idempotent installer for Codex hook configuration; repeated runs do not duplicate existing configuration.

- **add: cross-vendor** — extended detection/validation to recognize `codex-cli` as a legitimate `source_surface` for automatic handoffs.

- **add: documentation** — documented the Codex flow `PreCompact(auto) -> handoff -> validation -> compaction` and the distinction between runtime auto-activation and manual skill invocation.

- **add: metadata** — version bump to `1.3-universal`.

- **add: openai-metadata** — added the UI metadata required to distribute the skill on ChatGPT/OpenAI without changing the runtime behavior of the skill.

- **test: codex-auto-handoff** — verified hook syntax, valid handoff generation, output validation, and idempotent reinstallation without duplicating the hook.

## 1.2

- **add: handoff-template** — added a new `## TL;DR` block immediately after the YAML frontmatter, with three fixed fields (`What` / `Status` / `Next`); designed both as an immediate brief for the receiving model and for humans scanning the file quickly.

- **add: domain-addenda (Coding)** — added `Coding style/conventions agreed` and `DevSecOps practices agreed or applied` to the existing Coding addendum, recording conventions and security practices actually agreed during the session rather than a generic checklist.

- **add: domain-addenda (Coding)** — added `Regression battery to re-run`, so concrete command/test IDs from the agreed regression battery can be preserved and rerun after subsequent changes instead of merely describing what “should” be tested.

- **add: domain-addenda** — added a new `Changelog` addendum with an independent trigger from Coding: it activates whenever the session touches a changelog or release notes, even when no code is involved (documents, prompts, skills).

- **add: validate_handoff** — added a soft-fail check for a missing `## TL;DR` block immediately after the frontmatter.

- **add: handoff-validation** — documented the new soft-fail rule for a missing TL;DR block under `Soft failures`.

- **add: metadata** — version bump to `1.2-universal` in the skill frontmatter.

## 1.1

- **add: handoff_hook** — rewritten in pure Node.js and removed the Bash dependency; this avoids Windows breakage when Git Bash resolves to WSL, is unavailable, or Claude Code uses PowerShell as the hook shell.

- **add: handoff_hook** — default output now goes to the project directory (`<project>/.claude/handoffs/`) instead of Desktop, using the `cwd` field guaranteed by every hook payload; Desktop remains a fallback only when `cwd` is missing or not writable.

- **add: handoff_hook** — automatically creates `.claude/handoffs/.gitignore` containing `*` on first write, preventing raw dumps—which may contain secrets pasted during a session—from being committed.

- **add: naming convention** — standardized `handoff-<YYYY-MM-DD>-<project-slug>.md` everywhere, with `-2` / `-3` collision suffixes instead of silent overwrites.

- **add: YAML schema** — introduced mandatory frontmatter (`schema_version`, `originating_llm`, `source_surface`, `created_at`, `project_name`, `project_slug`, `kind_of_discussion`, `handoff_reason`, `status`) and optional fields (`handoff_sequence`, `language`, `tags`, `sensitive_content_flag`, `continues_from`).

- **add: validate_handoff** — added an executable validation harness for detecting empty or misplaced handoff files, with exit codes `0/1/2` (`pass` / `soft` / `hard`).

- **add: domain-addenda** — introduced composable optional blocks (`Coding` / `Research-Analysis` / `Writing-Explanation`) instead of multiple domain templates, avoiding premature forced classification and maintenance drift across parallel files.

- **add: intake** — trigger recognition is based on the attached file's shape (filename or frontmatter), not the verb or language used; this covers `intake`, `ingest`, `acquisisci`, `usa`, `importa`, `leggi`, and variants without requiring a closed phrase list.

- **add: cross-vendor** — `source_surface` is no longer a closed enum; non-Claude values such as `codex-cli` are treated as legitimate third-party producers instead of causing a hard failure, in line with the open Agent Skills standard.

- **fix: validate_handoff** — fixed an incorrect hard failure for unrecognized `source_surface` values that rejected valid handoffs produced by non-Claude tools.

- **fix: validate_handoff** — fixed frontmatter parsing for quoted values, which previously caused false negatives on correct `status` and `source_surface` values.

- **fix: validate_handoff** — normalized CRLF line endings before parsing; without this, files produced by Windows tools could fail frontmatter recognition.

- **fix: validate_handoff** — added an explicit check for the placeholder `(transcript could not be parsed)`, which previously could pass the minimum real-content threshold because of surrounding boilerplate.

- **add: sensitive_content_flag** — the field now generates an active warning during intake instead of acting as documentation only.

- **add: install_hooks** — added a new installer that safely merges `Stop` / `PreCompact` hooks into `~/.claude/settings.json`, with automatic backup and without touching unrelated existing keys; supports `--dry-run`, `--project`, `--windows`, and `--posix`.

- **fix: install_hooks** — backups are no longer created when there is no actual change to write, avoiding unnecessary backup files.

- **add: verified/unverified tagging** — added a general base-template rule, independent of any specific domain addendum, requiring claims to be marked `[verified: ...]` or `[UNVERIFIED: ...]`, with special emphasis on claims inherited through `continues_from`.

- **add: validate_handoff** — added a warning when `continues_from` is set but the body contains no verification tags, highlighting the risk of inherited claims never being re-verified.

- **add: domain-addenda** — added concrete examples of domain-specific verification probes (`git status/log` for coding, re-fetching a source for research, rereading user messages for writing) as an optional detail of the general tagging rule.

## 1.0

- **add: handoff** — first working release: manual generation (`handoff` / `/handoff`) of a session-continuity file containing Goal / Decisions / Rejected paths / verbatim WIP / Next step.

- **add: handoff** — best-effort automation for Claude Code through `PreCompact` / `Stop` hooks, with a configurable threshold based on approximate token counting.

- **add: metadata** — added `author` and `version` to the skill YAML frontmatter.
