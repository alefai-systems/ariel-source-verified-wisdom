# Loop Engineering foundation

Status: executable prototype checkpoint. The original empty-workspace evidence from the first 2026-07-17 checkpoint is retained below.

## Observed repository state

At the start of the first checkpoint, `C:\Projects\tree-a` existed as a normal directory and contained zero files or directories, including hidden entries. It had no local `.git`, application source, Ariel MVP, manifests, lockfiles, tests, validation configuration, or README.

The only evidence-backed architecture map was therefore:

```text
C:\Projects\tree-a\
└── [empty]
```

That first checkpoint established contracts and re-entry gates only. A later explicit instruction authorized the isolated executable prototype described below; it still does not claim to describe or modify the absent Ariel MVP.

## Executable vertical slice

The first source-verification slice now lives at `prototype/source-verification` and uses plain CommonJS with Node.js standard-library modules only:

```text
prototype/source-verification/
├── package.json
├── README.md
├── cli/demo.js
├── src/
│   ├── claims.js
│   ├── constants.js
│   ├── errors.js
│   ├── index.js
│   ├── registry.js
│   └── verifier.js
└── test/
    ├── claims.test.js
    ├── fixtures.js
    ├── registry.test.js
    └── verifier.test.js
```

Implementation decisions made for this slice:

- `sourceId` is stricter than the provisional logical-source model: one ID permanently binds one exact `sourceVersion` and canonical text. Changed content requires a new ID and version.
- The registry is a persistent immutable value; adding a source returns a new registry, and resolved snapshots are frozen.
- SHA-256 is recomputed from exact UTF-8 bytes during verification. Neither resolver hash metadata nor byte-length metadata is trusted without recomputation.
- Ranges are zero-based, end-exclusive UTF-8 byte offsets. Empty ranges are explicitly invalid, and multibyte-splitting boundaries fail closed.
- Missing, throwing, or malformed resolvers return structured `SOURCE_UNAVAILABLE` results without exposing resolver exceptions or source content.
- Resolved identity is checked against the requested identity and any caller-bound expected identity before acceptance.
- A claim needs at least one declared source support; every declared support must verify for the claim to be accepted.

Validation on Node.js `v24.12.0` after independent review and correction:

- `node --test`: 51 reported tests, 51 passed, 0 failed.
- `node .\cli\demo.js`: exit 0; Hebrew registration/retrieval and SHA-256 verification passed, while tampered quotation, unknown source, and unsupported claim were rejected with the expected codes.
- Independent reviewer verdict: accept, with all 20 task-mandated automated cases directly covered.

## Purpose

Loop Engineering makes every implementation claim traceable to source evidence and independently reproducible. The first loop is deliberately small:

```text
explore source -> propose evidence -> implement minimally -> verify mechanically -> review independently -> accept or return
```

Acceptance requires both a valid source reference and independent reproduction of the exact quotation.

## Provisional source contract

The runtime and storage model are unknown, so this contract must be reconciled with the restored repository before code is written.

### Source snapshot

Each verifiable source snapshot should provide:

- `sourceId`: non-empty, case-sensitive string identifying a logical source in a documented namespace.
- `sourceVersion`: required non-empty, case-sensitive string identifying an immutable revision. A logical source edit creates a new version.
- `canonicalText`: content preserved exactly as ranges address it.
- `contentHash`: digest of that exact canonical content, with `hashAlgorithm` recorded; the provisional baseline is SHA-256 over UTF-8 bytes.
- `encoding` and `newlinePolicy`: explicit ingestion metadata; the baseline is UTF-8 with newlines preserved.

The pair `(sourceId, sourceVersion)` must resolve to exactly one snapshot. Duplicate or ambiguous resolution is an error.

### Quotation claim

Each claim should provide:

- `sourceId` and `sourceVersion`.
- `start` and `end` offsets.
- `offsetUnit`, provisionally `utf8-byte`.
- `quotation`, copied exactly from the canonical text.
- Required expected `contentHash` and `hashAlgorithm`.
- Optional externally bound expected identity when a caller requires a particular source rather than merely an internally valid claim.

Ranges are zero-based and end-exclusive: `[start, end)`. A quotation range must be non-empty, use safe integer offsets, and satisfy `0 <= start < end <= sourceByteLength`. Both offsets must fall on valid UTF-8 character boundaries.

UTF-8 byte offsets make persisted ranges deterministic across runtimes. Adapters for UIs or runtimes that index UTF-16 code units or Unicode code points must convert explicitly and have conformance tests. CRLF bytes and Unicode normalization forms are preserved exactly.

### Verification result

A verifier should return a structured result containing:

- `ok`.
- A stable reason code when `ok` is false.
- Resolved source identity, version, and content hash.
- The checked range and extracted text.
- Verifier contract/version identifier.

Baseline failure codes are:

- `INVALID_SOURCE_ID`
- `INVALID_SOURCE_VERSION`
- `UNKNOWN_SOURCE`
- `AMBIGUOUS_SOURCE`
- `STALE_SOURCE_VERSION`
- `SOURCE_IDENTITY_MISMATCH`
- `SOURCE_INTEGRITY_MISMATCH`
- `SOURCE_UNAVAILABLE`
- `INVALID_RANGE`
- `RANGE_OUT_OF_BOUNDS`
- `RANGE_NOT_UTF8_BOUNDARY`
- `QUOTATION_MISMATCH`
- `REVIEWER_NOT_INDEPENDENT`
- `ILLEGAL_STATE_TRANSITION`

`INVALID_SOURCE_VERSION` covers missing, non-string, empty, or whitespace-only versions. `STALE_SOURCE_VERSION` covers a well-formed version that does not resolve for a known source or is no longer retrievable. `SOURCE_IDENTITY_MISMATCH` covers either a resolver returning a different `sourceId` than requested or a caller-bound expected identity differing from the resolved identity. A self-consistent claim for another independently valid identity remains valid when that identity was requested and no external binding says otherwise.

All failures are closed: a claim is not usable merely because verification could not run.

## Verification loop

1. **Explore:** locate the authoritative source store and its ingestion rules. Capture a candidate claim against an immutable snapshot.
2. **Preflight:** validate shape, source identity, version, external identity binding when supplied, hash, offset unit, and numeric bounds.
3. **Extract:** resolve the source independently, encode its unmodified canonical text as UTF-8, validate character boundaries, and slice the declared byte range.
4. **Compare:** require byte-for-byte equality after encoding both extracted and claimed strings as UTF-8. Do not trim, case-fold, normalize, or rewrite newlines.
5. **Implement:** use only verified claims in the smallest scoped change; retain the verification evidence.
6. **Review:** a reviewer resolves the source afresh, reruns extraction and comparison, inspects the actual diff, and reruns the discovered repository checks.
7. **Decide:** accept only when all gates pass. Otherwise return the stable failure reason to exploration or implementation.

### Claim states

The minimal state flow is:

```text
PROPOSED -> MACHINE_CHECKED -> VERIFIED
    |              |             |
    +-> BLOCKED    +-> REJECTED  +-> SUPERSEDED
    +-> REJECTED   +-> BLOCKED
```

- Automation alone can move `PROPOSED` to `MACHINE_CHECKED`.
- Only an independent reviewer can move `MACHINE_CHECKED` to `VERIFIED`.
- An unavailable source produces `BLOCKED`; retry starts the full verification again.
- A deterministic failure produces `REJECTED` with a reason code and evidence.
- Verified records are immutable. Corrections create a replacement and mark the old record `SUPERSEDED`.
- An integrity audit that finds different bytes under the same identity/version quarantines affected evidence; it never silently preserves `VERIFIED`.

## Roles and required outputs

### Explorer

The explorer is read-only. They produce:

- Repository and data-flow map with file-path evidence.
- The explicit Ariel MVP boundary.
- Source storage, ingestion, versioning, and quotation seams.
- Candidate source snapshots and claims.
- Discovered validation commands and constraints.
- Unknowns that must remain unresolved rather than guessed.

### Implementer

The implementer receives an approved contract and produces:

- A minimal diff outside the protected Ariel boundary unless explicitly authorized.
- Contract tests before or alongside the verifier.
- A change record linking behavior to verified source claims.
- Exact commands and complete outcomes for relevant validation.
- No self-approval.

### Independent reviewer

The reviewer uses a fresh read of source evidence and produces:

- An invariant-by-invariant verdict.
- Independent source resolution, extraction, and exact-match evidence.
- Diff-scope confirmation, including Ariel protection.
- Independently rerun test, lint, typecheck, and build results.
- A clear `accept` or `return`, with blocking reason codes.

Reviewer independence requires access to primary source records, the actual diff, and raw command output. An implementer summary alone is insufficient.

## Risks and missing infrastructure

| Severity | Risk or gap | Consequence | Re-entry gate |
| --- | --- | --- | --- |
| Critical | The scoped directory began empty and remains non-Git outside the isolated prototype | The intended product checkout and audit history are still absent | Restore product repository contents inside the approved folder when explicitly authorized; do not initialize Git for this prototype |
| Critical | Ariel MVP boundary is unavailable | Its files cannot be named or mechanically protected | Map and record exact protected paths before implementation |
| High | The source registry is in-memory and ingestion is unauthenticated | SHA-256 proves self-consistency, not source provenance or durability | Define an authenticated durable adapter before production use |
| High | UTF-8 behavior is implemented only in the isolated Node prototype | Other runtimes may use incompatible offsets or normalization | Require adapter conformance tests before any cross-runtime integration |
| High | The prototype has a package manifest and test runner but no CI or product validation stack | Automated checks are local only | Integrate only after the product repository and native validation workflow are known |
| High | No Git checkpoint is available | Current work cannot be preserved or audited through Git | Establish the repository baseline before code or UI changes |
| Medium | Reviewer may reuse implementer-derived evidence | Independent review becomes circular | Require fresh source resolution and raw outputs |

## Ordered next implementation steps

Before any production or Ariel integration:

1. Complete the remaining executable conformance cases in `SOURCE_VERIFICATION_TEST_PLAN.md`, especially authoritative byte fixtures, non-BMP boundaries, duplicate occurrences, and property/mutation checks.
2. When explicitly authorized and the intended product repository is present, re-read repository-local instructions and capture a local Git baseline.
3. Map entry points, modules, data flow, manifests, validation commands, and the exact Ariel MVP boundary.
4. Trace real `sourceId` creation, persistence, lookup, source versioning, canonical text ingestion, and quotation extraction.
5. Reconcile the strict prototype identity rule with observed product semantics; document adapters or migrations rather than silently changing offsets.
6. Add a durable authenticated source/evidence adapter and integration coverage for fail-closed caller behavior.
7. Run all repository-defined tests, lint, typecheck, and build after confirming no dev server is running.
8. Have an independent reviewer reproduce source evidence, inspect the actual change set, and rerun the full validation set.

The standalone prototype was explicitly authorized despite the absent product repository. Do not begin product or Ariel integration while its boundary, source semantics, or native validation stack remains unknown.
