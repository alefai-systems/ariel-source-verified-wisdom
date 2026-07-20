# Tree A agent instructions

## Scope and safety

- Work strictly inside `C:\Projects\tree-a`. Do not inspect or change parent or sibling paths.
- Do not deploy, publish, push, or install global software.
- Prefer minimal, reversible changes. Do not ask questions when a safe, conservative path is available.
- Stop before Shabbat, leave a written checkpoint, and do not resume without an explicit instruction.

## Protect the Ariel MVP

- Treat every existing Ariel MVP file as immutable unless a task explicitly authorizes a named change.
- When the repository is available, identify and record the Ariel boundary before implementation work.
- Before any authorized UI change, preserve the current working state with a recoverable Git checkpoint and record the branch/status. Do not discard, reset, or overwrite unrelated user changes. Do not redesign unless explicitly asked.
- Never run a build while a development server is running.

## Discovery first

- Read repository-local instructions before acting.
- Map the source tree, manifests, entry points, data flow, tests, and validation commands from repository evidence.
- If files or tooling are absent, report that fact. Do not invent an architecture, runtime, or command.
- Keep exploration read-only and record the evidence used for implementation decisions.

## Loop Engineering roles

- **Explorer:** inspects the repository and source evidence read-only; produces an evidence-backed map, constraints, and candidate seams.
- **Implementer:** makes only the approved, smallest change; records assumptions, changed files, and validation output.
- **Independent reviewer:** does not rely on the implementer's summary; reopens the source records and diff, reruns relevant checks, and accepts or rejects each invariant with evidence.
- The implementer must not approve their own work. A failed or unavailable review gate fails closed.

## Source-verification baseline

- A quotation must resolve through a non-empty, stable `sourceId` and an immutable source version.
- Persisted ranges must declare their offset unit and use zero-based, end-exclusive bounds. The baseline unit is UTF-8 bytes, with both offsets on valid character boundaries.
- Extract from the preserved canonical source text. Do not trim, normalize Unicode, rewrite newlines, or change case before comparison.
- The extracted text must exactly equal the stored quotation.
- Reject unknown or ambiguous sources, stale versions, invalid or out-of-bounds ranges, offsets that split a UTF-8 sequence, integrity failures, and quotation mismatches.
- Preserve enough evidence to reproduce review: source identity/version, content hash, range, quotation, verifier version, and result.

## Validation and handoff

- Derive test, lint, typecheck, and build commands only from repository-local manifests or documentation.
- Run every existing relevant check after confirming no development server conflicts with a build.
- Distinguish `passed`, `failed`, and `unavailable`; never describe an unavailable check as passing.
- At a checkpoint, record observed state, files changed, commands and outcomes, unresolved risks, and ordered next steps.
