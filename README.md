# Ariel: Source-Verified Wisdom

Ariel: Source-Verified Wisdom is an early local prototype for making source-backed claims reproducible. It addresses a narrow but important problem: a quotation should not be accepted merely because it looks plausible. The supporting source, immutable identity, exact text range, and content integrity must all be mechanically verifiable.

## Current implementation

The repository currently contains one isolated source-verification vertical slice under `prototype/source-verification`. It provides:

- An immutable in-memory source registry with case-sensitive `sourceId` and `sourceVersion` evidence.
- SHA-256 integrity checks over exact UTF-8 source bytes.
- Zero-based, start-inclusive, end-exclusive UTF-8 byte ranges.
- Rejection of invalid, empty, reversed, out-of-bounds, or multibyte-splitting ranges.
- Exact quotation comparison without trimming, case conversion, Unicode normalization, or newline rewriting.
- Fail-closed claim support requiring at least one verified source range.
- Deterministic structured errors for unknown sources, integrity failures, resolver failures, range failures, and quotation mismatches.
- Synthetic Hebrew and niqqud fixtures, a local CLI demonstration, and a standard-library-only automated test suite.

The prototype does not import or modify an Ariel MVP.

## Architecture overview

| Area | Responsibility |
| --- | --- |
| `src/registry.js` | In-memory immutable registry and SHA-256 source snapshots |
| `src/verifier.js` | Source resolution, integrity, UTF-8 range, identity, and exact quotation verification |
| `src/claims.js` | Fail-closed verification of declared claim supports |
| `src/errors.js` | Stable structured error results |
| `src/index.js` | Public module exports |
| `test/` | Registry, quotation, Hebrew, integrity, range, resolver, claim, and determinism tests |
| `cli/demo.js` | Visible local success and rejection demonstration |

The prototype deliberately uses a stricter identity rule than the provisional logical-source design: one `sourceId` permanently binds one exact version and canonical text. Changed content must receive a new ID and version.

## Installation and verification

Prerequisite: Node.js. The verified baseline uses Node.js `v24.12.0` and npm `11.11.0` on Windows.

There are no external dependencies and no installation step. Do not run `npm install`.

From PowerShell:

```powershell
cd C:\Projects\tree-a\prototype\source-verification
node --test
node .\cli\demo.js
```

Equivalent package scripts are available as `npm test` and `npm run demo`, but the verified baseline commands above invoke Node directly.

## Current verified results

Verified locally on 2026-07-21:

- `node --test`: 51 tests passed, 0 failed.
- `node .\cli\demo.js`: exit code 0.
- The CLI registered and retrieved exact synthetic Hebrew text, verified SHA-256 integrity, and rejected a tampered quotation, an unknown source, and an unsupported claim.
- Runtime dependencies: 0.
- Development dependencies: 0.

## How OpenAI Codex was used

OpenAI Codex was used as an engineering collaborator to inspect the isolated repository, define the verification contract, implement and test the prototype, perform an independent review and correction pass, document the current architecture, and establish this verified local Git baseline. The resulting code and documentation remain subject to normal human review before product use.

## GPT-5.6 integration status

GPT-5.6 product integration is **not implemented**. This repository currently makes no OpenAI API calls, contains no model orchestration, and requires no API key. No deployment or external service integration is included.

## Known limitations

- Sources and verification evidence are in-memory and synchronous; they are not persisted across process restarts.
- SHA-256 proves byte consistency, not source authority, licensing, or provenance.
- The claim gate verifies declared exact source support but does not evaluate semantic entailment.
- Authentication, authorization, concurrency, state transitions, durable storage, CI, and production adapters are not implemented.
- Broader planned coverage still includes authoritative byte-fixture loading, non-BMP boundaries, duplicate occurrences, and property/mutation testing.
- There is no product UI, Ariel MVP integration, GPT-5.6 integration, or deployment configuration.

## Repository structure

```text
tree-a/
├── .gitignore
├── AGENTS.md
├── CHECKPOINT.md
├── README.md
├── docs/
│   └── loop-engineering/
│       ├── FOUNDATION.md
│       └── SOURCE_VERIFICATION_TEST_PLAN.md
└── prototype/
    └── source-verification/
        ├── README.md
        ├── package.json
        ├── cli/
        ├── src/
        └── test/
```

## OpenAI Build Week context

This repository is being prepared as a safe, reproducible baseline for OpenAI Build Week development. The present milestone proves only the local source-verification loop. Model integration, product behavior, UI work, and deployment are intentionally deferred to later, separately reviewed tasks.

## License status

No license has been selected or added. Do not assume that this repository grants permission to use, modify, or redistribute its contents.
