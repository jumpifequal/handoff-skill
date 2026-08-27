# Handoff Examples

These examples are illustrative one-shot references. They are intentionally populated so the expected level of specificity is clear.

## Example 1 — Coding session

```markdown
---
schema_version: "1.0"
originating_llm: "Codex"
source_surface: "codex-cli"
created_at: "2026-08-27T14:30:00Z"
project_name: "Billing webhook retry"
project_slug: "billing-webhook-retry"
kind_of_discussion: "coding"
handoff_reason: "checkpoint"
status: "in-progress"
language: "en"
---

## TL;DR
- **What:** Added idempotent retry handling for failed billing webhooks.
- **Status:** Unit tests pass; no staging run yet.
- **Next:** Run the webhook integration test against the staging fixture and record the real retry sequence.

# Session Handoff — Billing webhook retry

## Goal
Prevent duplicate invoice side effects when the payment provider retries the same event.

## Decisions
- Decided: use the provider event ID as the idempotency key because it is stable across retries.
- Decided: persist processed event IDs in the existing database; do not add Redis unless throughput requirements change.
- Rejected: in-memory deduplication because it fails across restarts and multiple workers.

## Work-in-progress
Current handler logic is implemented in `src/webhooks/billing.ts`.

```ts
const existing = await processedEvents.find(event.id);
if (existing) return { status: "duplicate" };

await db.transaction(async (tx) => {
  await applyBillingEvent(tx, event);
  await processedEvents.insert(tx, event.id);
});
```

## Verification
- [verified: `npm test -- billing-webhook` passed 18/18]
- [verified: TypeScript compilation succeeds]
- [UNVERIFIED: retry timing in staging has not been observed]

### Coding context
- Language/runtime + version: Node 22 / TypeScript.
- Repo/project structure touched: `src/webhooks/`, `tests/webhooks/`.
- Test/validation status: unit tests passed; staging integration not run.
- Regression battery to re-run: `npm test -- billing-webhook`.
- Known-failing or untested paths: provider retry behaviour in staging.

## Next step
Run the webhook integration test against the staging fixture and record the real retry sequence.
```

## Example 2 — Research / analysis session

```markdown
---
schema_version: "1.0"
originating_llm: "ChatGPT"
source_surface: "chatgpt"
created_at: "2026-08-27T15:10:00Z"
project_name: "Competitor pricing analysis"
project_slug: "competitor-pricing-analysis"
kind_of_discussion: "research-analysis"
handoff_reason: "checkpoint"
status: "in-progress"
language: "en"
---

## TL;DR
- **What:** Compared current public pricing for three workflow-automation vendors.
- **Status:** Two vendors verified from primary pricing pages; one pricing tier remains unverified.
- **Next:** Verify Vendor C enterprise minimum from a primary source before finalizing the comparison table.

# Session Handoff — Competitor pricing analysis

## Goal
Produce an evidence-backed pricing comparison for a strategy memo.

## Decisions
- Decided: compare list prices only; negotiated enterprise discounts are out of scope.
- Decided: use annual-billing equivalents where both monthly and annual prices are offered.
- Rejected: crowdsourced pricing databases because the memo requires primary-source evidence.

## Current findings
- Vendor A Pro: [verified: current public pricing page]
- Vendor B Team: [verified: current public pricing page]
- Vendor C Enterprise minimum: [UNVERIFIED: secondary article; primary source not yet found]

## Open evidence gap
Vendor C does not expose the enterprise minimum on the public pricing page used so far.

### Research context
- Primary-source requirement: public vendor documentation or direct vendor material.
- Unresolved claim: Vendor C enterprise minimum.
- Do not convert the secondary-source number into a verified fact until checked.

## Next step
Verify Vendor C enterprise minimum from a primary source before finalizing the comparison table.
```

## Example 3 — Writing / documentation session

```markdown
---
schema_version: "1.0"
originating_llm: "Claude"
source_surface: "claude-chat"
created_at: "2026-08-27T16:00:00Z"
project_name: "Launch announcement"
project_slug: "launch-announcement"
kind_of_discussion: "writing-explanation"
handoff_reason: "manual"
status: "in-progress"
language: "en"
---

## TL;DR
- **What:** Drafted the launch announcement through the product-value section.
- **Status:** Structure and voice are approved; final proof and CTA are unfinished.
- **Next:** Write the final CTA in the same restrained tone without changing the approved opening.

# Session Handoff — Launch announcement

## Audience
Existing technical users evaluating whether to adopt the new workflow.

## Decisions
- Decided: lead with the operational problem, not the feature list.
- Decided: avoid “revolutionary,” “game-changing,” and similar launch clichés.
- Decided: keep the opening paragraph unchanged unless the user explicitly asks to revisit it.

## Work-in-progress
```markdown
Most AI sessions end before the work does.

Handoff turns the useful state of a session — decisions, exact work-in-progress,
evidence and the next action — into a portable file that another model can
continue from immediately.
```

### Writing context
- Voice: direct, technical, low-hype.
- Audience: experienced AI-tool users.
- Preserve: approved opening paragraph verbatim.
- Avoid: exaggerated productivity claims and vague “seamless AI” language.

## Next step
Write the final CTA in the same restrained tone without changing the approved opening.
```

## What the examples are demonstrating

Across domains, the invariants stay the same:

- decisions remain decisions;
- exact WIP is carried forward when fidelity matters;
- verification status remains visible;
- optional domain context appears only when relevant;
- the handoff ends with one concrete continuation action.
