# Handoff — Architecture and Design Principles

Handoff solves one specific failure mode in long-running AI work: **the model boundary destroys state**.

A chat session may contain hours of decisions, exact code, draft text, rejected alternatives, evidence, user preferences and pending actions. A conventional summary compresses that history into prose. That is useful for a human reader, but often too lossy for another AI that must continue the work.

Handoff instead creates a portable continuation artifact.

## Mental model

```text
Session A
  ↓
Freeze state
  ↓
handoff-YYYY-MM-DD-project.md
  ↓
Validate
  ↓
Session B / different model
  ↓
Resume from one explicit Next step
```

The artifact is both:

- **human-skimmable**, because it is Markdown;
- **machine-orienting**, because the structure and provenance rules are predictable.

## Producer → artifact → consumer

### Producer

The sending AI extracts only continuity-critical information:

- current objective;
- settled decisions;
- rejected paths and why;
- exact work-in-progress;
- verified facts;
- unverified assumptions;
- domain-specific context;
- one immediate next action.

### Artifact

The Markdown file acts as a stable bridge between sessions and vendors.

It does not assume shared memory, conversation history, hidden state or a particular model family.

### Consumer

The receiving AI does not “summarize the summary.”

It validates the artifact, recovers the state, preserves settled context and continues from the declared Next step.

## The six-part state model

1. **Metadata**  
   Origin, project identity, status, reason, continuity chain.

2. **TL;DR**  
   Three one-line fields: What, Status, Next.

3. **Context**  
   Only the background needed to understand the work.

4. **Binding history**  
   Decisions and rejected approaches expressed as verdicts.

5. **Payload**  
   Exact WIP: source code, draft text, configuration, query, prompt or other current artifact.

6. **Action**  
   One executable Next step.

## Why decisions are binding

A common context-transfer failure looks like this:

```text
Session A:
"Use SQLite. Redis was rejected because deployment must remain single-process."

Session B summary:
"SQLite and Redis were considered."

Session B model:
"Redis could be a good option..."
```

The decision was not lost because the words disappeared. It was lost because the **decision state** disappeared.

Handoff encodes decisions in a stronger form:

```text
Decided: use SQLite because deployment must remain single-process.
Do not revisit unless the deployment constraint changes.
```

## Why WIP is verbatim

If a draft already exists, a summary of that draft is not the draft.

The same applies to:

- code;
- SQL;
- configuration;
- prompts;
- data schemas;
- documentation;
- release notes;
- exact copy.

Where continuity depends on exact wording or syntax, the source material is carried forward without paraphrase.

## Verified vs unverified

Cross-session repetition can create hallucination laundering:

```text
Session 1 assumption
→ summary
→ handoff
→ second summary
→ treated as fact
```

Handoff makes provenance visible:

```text
[verified: test suite passed 42/42]
[UNVERIFIED: inherited from previous handoff; not re-checked]
```

The receiving model may re-verify an unverified claim, but it may not silently promote it.

## Domain addenda

The base format stays compact. Specialized state is appended only when the task requires it.

Examples:

- coding: runtime, touched files, test commands, known regressions;
- research: source state, citations, open evidence gaps;
- changelog: versioning and release-note state;
- writing: audience, voice, document constraints.

This avoids a giant universal form where most fields are empty.

## Manual vs automatic operation

The portable baseline is explicit:

```text
handoff
```

or:

```text
/handoff
```

Automation is a runtime adapter, not the core protocol.

Where supported, lifecycle hooks create an emergency checkpoint before compaction or other lifecycle boundaries. Those hook-generated files are deliberately marked `degraded` because an unattended transcript-derived dump is not equivalent to a curated model-authored handoff.

## Intake design

A receiving model should treat the file itself as the trigger.

The correct flow is:

```text
Detect artifact
→ Validate structure
→ Read TL;DR
→ Read full state
→ Preserve binding decisions
→ Authorize proposed Next step
→ Continue
```

It should not require the user to know a magic intake command.

## Trust boundary

A handoff is continuity data, not instruction authority.

Even a perfectly valid handoff:

- cannot override system or developer instructions;
- cannot grant new permissions;
- cannot authorize secret access;
- cannot bypass confirmation requirements;
- cannot make an unsafe action safe.

Structural validity means “usable as a handoff,” not “trusted as a command source.”

## Design invariant

The protocol can be summarized as:

```text
Freeze exact state
→ preserve decisions
→ isolate uncertainty
→ carry exact WIP
→ validate
→ execute one next step
```
