# Safe checkpoint handoff

Final stop recorded: 2026-07-17 18:37:51 +03:00, Asia/Hebron. This is before the 18:55 implementation cutoff and 19:00 hard stop.

Work is stopped at a valid executable vertical slice. Do not resume until explicitly instructed.

## Task objective

Create the first small, executable Tree A source-verification loop under `prototype/source-verification` using only plain JavaScript and the Node.js standard library. The slice must register immutable exact sources, verify SHA-256 integrity and UTF-8 byte ranges, validate exact quotations and claim supports, demonstrate Hebrew behavior locally, and fail closed with deterministic structured errors.

## Starting point and boundary

- The prior checkpoint contained only `AGENTS.md`, this handoff, and two Loop Engineering documents.
- The directory had no local `.git`, Ariel MVP, application source, dependency tree, or remote integration.
- Work remained strictly isolated under `C:\Projects\tree-a`; no internet, installation, Git initialization, deployment, publication, upload, external application, or Ariel access occurred.
- Only the implementation agent wrote prototype files. Explorer and reviewer work was read-only. The coordinator wrote documentation only after prototype writing and review had ended.

## Files created

```text
prototype/source-verification/package.json
prototype/source-verification/README.md
prototype/source-verification/cli/demo.js
prototype/source-verification/src/claims.js
prototype/source-verification/src/constants.js
prototype/source-verification/src/errors.js
prototype/source-verification/src/index.js
prototype/source-verification/src/registry.js
prototype/source-verification/src/verifier.js
prototype/source-verification/test/claims.test.js
prototype/source-verification/test/fixtures.js
prototype/source-verification/test/registry.test.js
prototype/source-verification/test/verifier.test.js
```

## Files modified

- `docs/loop-engineering/FOUNDATION.md`: appended the executable architecture, decisions, validation, current risks, and updated next steps while retaining the initial empty-state evidence.
- `docs/loop-engineering/SOURCE_VERIFICATION_TEST_PLAN.md`: marked the first slice executable and distinguished implemented coverage from the broader remaining plan.
- `CHECKPOINT.md`: replaced the prior handoff state with this current exact handoff.

`AGENTS.md` was not modified; its SHA-256 remained `2B0F2748AD50FB4790227885237F06B6D3943B8DD4D1D42E6D1F45813B818251`.

## Architectural decisions

- CommonJS on Node.js `v24.12.0`; package dependencies and development dependencies are both empty.
- A case-sensitive `sourceId` permanently binds one exact `sourceVersion` and canonical text in this prototype. Re-registering the same tuple is idempotent; reusing the ID for different content or version is rejected.
- The registry is an immutable persistent value, and snapshots/evidence are frozen.
- SHA-256 is recomputed over exact UTF-8 bytes during verification.
- Ranges are zero-based, start-inclusive, end-exclusive UTF-8 byte offsets. Empty ranges are invalid. Unsafe, negative, reversed, out-of-bounds, and multibyte-splitting offsets fail closed.
- Text is never trimmed, normalized, case-folded, or newline-rewritten.
- Resolver absence, exceptions, malformed snapshots, or returned identity mismatches produce structured non-leaking failures.
- A claim needs at least one support, and every declared support must independently verify.

## Exact commands and results

Commands executed from `C:\Projects\tree-a\prototype\source-verification`:

```powershell
node --version
node --test
node .\cli\demo.js
rg -n 'require\(|from\s+|import\s+' src test cli
```

Scope/document checks executed from `C:\Projects\tree-a` included:

```powershell
Get-ChildItem -LiteralPath 'C:\Projects\tree-a' -Force -Recurse -File
Test-Path -LiteralPath 'C:\Projects\tree-a\.git'
rg -n '^(<<<<<<<|=======|>>>>>>>)' .
```

The final PowerShell scope audit also parsed `package.json`, checked the exact expected file list, UTF-8 readability, final newlines, trailing whitespace, balanced Markdown fences, dependency artifacts, reparse points, and the unchanged `AGENTS.md` hash.

| Check | Exact result |
| --- | --- |
| Node version | `v24.12.0` |
| Pre-review test run | 44 reported, 44 passed, 0 failed |
| Final `node --test` | 51 reported, 51 passed, 0 failed, 0 skipped/cancelled/todo; duration 111.9527 ms |
| Final CLI | Exit 0; all required success and rejection demonstrations passed |
| Required automated cases | 20/20 directly covered after correction |
| Dependencies | 0 runtime, 0 development; no lockfile or `node_modules` |
| Scope QA | Passed; exactly 17 expected files, no unexpected files, no local `.git`, no reparse points |
| Documentation QA | Passed; UTF-8 readable, final newlines present, fences balanced, no conflict markers or trailing whitespace |
| Lint | Not defined; not run and not claimed passing |
| Typecheck | Not defined; not run and not claimed passing |
| Build | Not defined; not run and not claimed passing |

Two draft PowerShell audit one-liners had parser/quoting errors before their checks ran; corrected read-only audits completed successfully. No guessed package installation or build command was run.

## CLI demonstration result

```text
[registration] sourceId=demo-hebrew-rtl sourceVersion=v1 bytes=47
[retrieval] exact=true text=מקור א: ״עֵץ 42?״ (בדיקה) ‏RTL
[integrity] PASS sha256=fcfa677dfcfc2fba40060ed481414634c53f103714a09799397b081b5fa0acbc
[rejection:tampered-quote] PASS code=QUOTATION_MISMATCH
[rejection:unknown-id] PASS code=UNKNOWN_SOURCE
[rejection:unsupported-claim] PASS code=UNSUPPORTED_CLAIM
```

## Independent review

The first review returned the slice for correction:

- P1: a foreign resolver could return a different source identity and be accepted.
- P2: throwing or malformed resolvers escaped structured `SOURCE_UNAVAILABLE` behavior.
- P2: deterministic repeated success, one-character deletion, and added-character cases lacked direct tests.
- P2/P3: broader provisional cases remained future work and status documentation was stale.

Focused corrections:

- Validate resolver interface, snapshot shape, resolved identity, and caller-bound identity before acceptance.
- Catch resolver failures without exposing exception text; derive byte length from canonical UTF-8 bytes rather than resolver metadata.
- Add direct wrong-source, unavailable/malformed resolver, deterministic-success, deletion, and addition regressions.
- Update the prototype README and Loop Engineering status documentation.

The final independent reviewer verdict was **accept** at 18:32:22 +03:00, with 51 tests passed, 0 failed, the CLI passing, 20/20 mandatory cases directly covered, and no new actionable finding.

A later documentation seal review found two non-code inconsistencies: the foundation still described `SOURCE_IDENTITY_MISMATCH` as caller-binding-only, and this handoff used the wrong timezone label. Both lines were corrected; no implementation or test change was required.

## Remaining limitations

- Registry and evidence are in-memory and synchronous; there is no durable or authenticated ingestion/storage adapter.
- SHA-256 proves byte consistency, not source authority or provenance.
- Semantic entailment between a claim and a quotation is not evaluated; this slice proves declared exact source support only.
- The broader test plan still needs authoritative hex-fixture loading, non-BMP and duplicate-occurrence cases, property/mutation or fuzz tests, state transitions, persistence/restart tests, and CI.
- There is no product repository, Ariel boundary, Git audit history, concurrency model, authorization layer, or production integration.

## Exact next recommended implementation step

Implement the remaining executable conformance suite from `docs/loop-engineering/SOURCE_VERIFICATION_TEST_PLAN.md`—authoritative byte fixtures, non-BMP boundaries, duplicate occurrences, and deterministic property/mutation tests—against the current pure verifier before adding persistence or any Ariel/product integration.

This checkpoint is sealed. All active implementation work stopped before 18:55, and no work will resume until explicitly instructed.
