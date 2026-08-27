# Domain Addenda

Optional blocks appended to Section 4 (Work-in-progress) of the base
handoff template — never a replacement for it, never a separate file per
domain. A conversation can match zero, one, or several. Only append an
addendum if its trigger condition is actually true of *this* conversation;
within an appended addendum, only include fields that have real content —
drop the rest rather than writing "N/A".

This is deliberately not a closed list. Add a new addendum block the same
shape as these when a genuinely recurring domain shows up — don't fork
`SKILL.md` or `handoff-template.md` to do it.

The `[verified: ...]` / `[UNVERIFIED: ...]` tagging rule in
`handoff-template.md` applies whether or not any addendum below matches —
it's a base-template rule, not something these addenda grant. What each
addendum below adds is just a concrete example of what "verified" can mean
in that domain, for convenience.

---

## Coding Addendum

**Trigger:** the conversation involved writing, editing, debugging, or
reviewing code.

**Concrete probe examples for this domain:** `git status`, `git log -1`,
running the actual test suite, `gh pr list` — a claim like "this is
already implemented" is `[verified: git log shows commit abc123]` or
`[UNVERIFIED: stated in a prior handoff, not re-checked]`, never just
asserted.

```markdown
### Coding context
- Language/runtime + version: <e.g. Python 3.12, Node 22>
- Repo/project structure touched: <paths that matter, not a full tree>
- Dependencies pinned or assumed: <package + version, only if it matters>
- Coding style/conventions agreed: <e.g. linter/formatter + config actually
  in use, naming conventions, docstring style, import ordering — only ones
  actually agreed or already enforced by repo config, not generic advice>
- DevSecOps practices agreed or applied: <e.g. no secrets in code/commits,
  input validation on external data, dependency versions pinned, least-
  privilege for any credentials/scopes touched, secrets via env/vault not
  hardcoded — only what was actually discussed or applied this session,
  never a generic checklist padded in by default>
- Test/validation status: <what was actually run and its result — "syntax
  checked, not run," "8/8 test cases passed," etc. State the real status,
  don't imply more verification happened than did.>
- Regression battery to re-run: <the specific command(s)/test file(s)/test
  ID(s) agreed as the standing suite to re-execute after each further
  change — e.g. "pytest tests/ -k auth", "npm test", "tests/test_login.py
  ::test_expired_token" — not a description of what testing "should"
  cover>
- Known-failing or untested paths: <anything explicitly not yet verified>
```

## Changelog Addendum

**Trigger:** the conversation maintained, drafted, or updated a changelog
or release notes — regardless of whether the conversation also involved
writing code. A changelog can belong to a piece of software, but equally
to a document, a prompt/skill package, a dataset, or any other versioned
deliverable. Append this addendum whenever it applies, independently of
whether the Coding Addendum above also applies.

**Concrete probe examples for this domain:** the actual changelog file or
section as it exists after this session — a claim like "the changelog is
up to date" is `[verified: CHANGELOG.md shows the new entry as of this
session]` or `[UNVERIFIED: stated, changelog not re-read]`.

```markdown
### Changelog context
- Changelog format/style agreed: <e.g. Keep a Changelog, Conventional
  Commits-derived, plain dated bullet list, a house style the user
  specified — only the style actually agreed or already in use, not a
  format imposed by default>
- Versioning scheme: <semver | calendar versioning | unversioned/dated
  entries | other — whatever this project actually uses>
- File/location: <path or name of the changelog artifact touched>
- Entries added or pending this session: <verbatim entries, not
  paraphrased — the next model should be able to drop these straight in>
- Unreleased/pending section state: <e.g. "Unreleased has 3 entries not
  yet cut into a version," if that distinction is in use>
```

## Research / Analysis Addendum

**Trigger:** the conversation involved evaluating claims, comparing
sources, or synthesizing evidence toward a conclusion.

**Concrete probe examples for this domain:** actually re-fetching a cited
source rather than trusting a remembered summary of it — a claim is
`[verified: fetched <url>, confirms X]` or `[UNVERIFIED: cited secondhand,
not fetched this session]`.

```markdown
### Research context
- Sources actually consulted: <title/URL — only ones actually fetched or
  cited in this conversation, not ones that would be nice to check>
- Claims still unverified: <flag anything treated as provisional>
- Methodology/approach agreed on: <how the analysis was being done, if a
  specific method was chosen and should not be re-litigated>
- Conflicting evidence noted: <where sources disagreed, and how it was
  being handled>
```

## Writing / Explanation Addendum

**Trigger:** the conversation involved drafting prose, documentation, or
an explanation meant for a specific audience.

**Concrete probe examples for this domain:** re-reading the user's actual
messages for a stated constraint rather than an inferred one — "the user
wants a formal tone" is `[verified: user said "keep it formal" in this
conversation]` or `[UNVERIFIED: inferred from context, not stated]`.

```markdown
### Writing context
- Audience and register: <who this is for, and the tone level agreed on>
- Length/format constraints given: <word count, structure, required
  sections>
- Voice/style corrections the user actually made: <only things the user
  corrected or specified, not invented style preferences>
```
