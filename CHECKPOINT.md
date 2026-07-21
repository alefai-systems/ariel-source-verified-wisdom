# Safe checkpoint handoff

Checkpoint updated: 2026-07-21, Asia/Hebron, for the owner-supplied live validation and feature-branch release gates.

Do not rerun the OpenAI live smoke. Stop after the reviewed documentation commit and authorized feature-branch push; do not merge, deploy, tag, release, create an issue or pull request, or begin another task.

## Objective

Replace the synthetic Ariel demonstration fixture with a pinned public-domain JPS 1917 corpus retrieved from exact Sefaria Texts v3 endpoints, while preserving the existing source-verification boundary and keeping displayed quotation text outside model control. Increase the Responses output bound to 2,000 tokens and make completion/incomplete-status handling explicit. This update records the project owner's successful live GPT-5.6 validation without changing application behavior.

## Git boundary

- Branch: `feature/gpt-5.6-ariel-demo`.
- Original JPS corpus starting HEAD: `630e1d85ccfb831d702ebad0692e344d6639783d`.
- Release-documentation starting HEAD: `3dc983153e47f77b4fb829b396999d0f5c4d8c6b`.
- Required release baseline: source verifier 51/51, Ariel demo 44/44, source CLI exit 0, fake demo exit 0.
- Every file under `prototype/source-verification` remains unchanged.
- The prior corpus and interpretation-policy work was not pushed during those checkpoints. This release authorizes only pushing the current feature branch after all gates pass.
- No merge, deployment, dependency installation, tag, release, issue, or pull request is authorized.
- Requested documentation commit message: `docs: record successful GPT-5.6 live validation`.

## Exact external source retrieval

Network access was limited to these two official Sefaria endpoints:

```text
https://www.sefaria.org/api/v3/texts/Psalms.85.10-14?version=english%7CThe%20Holy%20Scriptures%3A%20A%20New%20Translation%20%28JPS%201917%29&return_format=text_only&fill_in_missing_segments=0
https://www.sefaria.org/api/v3/texts/Proverbs.12.19?version=english%7CThe%20Holy%20Scriptures%3A%20A%20New%20Translation%20%28JPS%201917%29&return_format=text_only&fill_in_missing_segments=0
```

Both selected responses returned exactly:

```text
versionTitle: The Holy Scriptures: A New Translation (JPS 1917)
language: en
actualLanguage: en
languageFamilyName: english
license: Public Domain
status: locked
warnings: []
```

Psalms returned reference `Psalms 85:10-14` and exactly five non-empty segments. Proverbs returned reference `Proverbs 12:19` and one non-empty string. There was no default-English, Revised JPS 2023, reference, license, language, or missing-segment substitution.

Retrieval checkpoint stored in metadata: `2026-07-21T04:51:44.8906045+03:00`.

## Pinned source metadata

All source records preserve source identity, registered reference, applicable alternate reference, content-addressed version, title, language, license and license note, provider, exact source URL, retrieval checkpoint, normalization contract, SHA-256, attribution, and segment references/ranges.

Attribution:

```text
Text: The Holy Scriptures: A New Translation (JPS 1917), Public Domain. Digital text via Sefaria.
```

### Psalms 85:10-14

- `sourceId`: `jps-1917-psalms-85-10-14`
- `sourceVersion`: `sha256:0391d2350d08cac6bb8e535451f59f4606e132782c94b41799ca83e8da54a312`
- UTF-8 byte length: 399
- SHA-256: `0391d2350d08cac6bb8e535451f59f4606e132782c94b41799ca83e8da54a312`
- Segment ranges, zero-based and end-exclusive:
  - Psalms 85:10 `[0, 82)`
  - Psalms 85:11 `[83, 164)`
  - Psalms 85:12 `[165, 246)`
  - Psalms 85:13 `[247, 328)`
  - Psalms 85:14 `[329, 399)`
- Primary verified reference: `Psalms 85:12`
- Alternate numbering: `Psalm 85:11 (common Christian/KJV numbering)`
- Exact quotation: `Truth springeth out of the earth; And righteousness hath looked down from heaven.`

The four one-byte gaps are the ASCII spaces inserted between canonical API-order segments. Psalm 85:12 is found by segment reference after its range is derived from accumulated UTF-8 byte lengths; the implementation does not search for or hardcode the quotation offset.

### Proverbs 12:19

- `sourceId`: `jps-1917-proverbs-12-19`
- `sourceVersion`: `sha256:1c577e59924bcad0b8b2b06016abc12d9e9ff3b841c463a1698ea551bdf70ed4`
- UTF-8 byte length and range: 87, `[0, 87)`
- SHA-256: `1c577e59924bcad0b8b2b06016abc12d9e9ff3b841c463a1698ea551bdf70ed4`
- Exact quotation: `The lip of truth shall be established for ever; But a lying tongue is but for a moment.`

## Canonicalization

`ariel-sefaria-text-v1` applies this deterministic order:

1. Decode HTML entities.
2. Replace `br` elements and line breaks with one space.
3. Remove remaining HTML tags.
4. Normalize Unicode to NFC.
5. Trim leading/trailing whitespace.
6. Collapse internal whitespace to one space.
7. Preserve capitalization and punctuation.
8. Encode as UTF-8.
9. Hash the final stored bytes with SHA-256.

Each segment is canonicalized independently, retained in API order, and joined with one ASCII space. Tests cover entities, `br`, CRLF/newlines, tags, NFC, whitespace, multibyte UTF-8 range derivation, deterministic repetition, and metadata/hash drift. The selected Texts v3 output itself needed no textual changes.

## Architecture and trust boundary

1. The browser sends only a bounded question and explicit tamper-simulation flag to a loopback server.
2. The fake or optional OpenAI client returns a completion envelope containing strict model output.
3. The model output schema permits only `interpretation`, `support_status`, and at most one opaque token: `jps-source-a` or `jps-source-b`.
4. The prompt provides excerpt context but not source IDs, versions, hashes, ranges, URLs, or mutable metadata.
5. The server resolves the token through a frozen manifest, reconstructs the declared range from immutable registry bytes, and submits it to the existing Claim Gate.
6. `exactQuotation` is copied only from successful `gate.claim.supports[0].extractedText` evidence.
7. Unknown, malformed, unsupported, integrity-failed, or tampered paths release no quotation.

The UI displays canonical reference, alternate numbering when applicable, version title, Public Domain license, Sefaria provider, exact verified quotation, UTF-8 range, and SHA-256 integrity result. It explicitly states that Sefaria does not verify the interpretation, semantic entailment is not implemented, and SHA-256 does not prove source authority.

## OpenAI request and completion handling

- Endpoint: `POST https://api.openai.com/v1/responses`.
- Default model: `gpt-5.6-sol` with server-side `OPENAI_MODEL` override.
- `store: false`.
- `reasoning.effort: low`.
- `max_output_tokens: 2000`.
- Strict JSON Schema through `text.format`.
- Native `fetch`, 20-second abort timeout, no retry, no dependency.
- A payload is parsed only when `response.status === "completed"`.
- `status: "incomplete"` fails as `MODEL_INCOMPLETE` and retains only the exact `incomplete_details.reason`.
- The live-smoke formatter renders that exact reason with `JSON.stringify`; every other non-completed status fails closed.
- The live-smoke script also explicitly requires `result.model.responseStatus === "completed"` before success.

## Successful live validation supplied by the project owner

On 2026-07-21, the project owner ran `prototype/ariel-demo/scripts/live-smoke.js` with provider OpenAI and model `gpt-5.6-sol`. The Responses API status was `completed`, and Ariel returned outcome `verified`.

- GPT selected an opaque allowed reference. The server resolved it to `Psalms 85:12` within registered source `Psalms 85:10-14`.
- Version: **The Holy Scriptures: A New Translation (JPS 1917)**.
- Digital text provider: Sefaria; recorded license: **Public Domain**.
- Exact immutable-registry quotation: `Truth springeth out of the earth; And righteousness hath looked down from heaven.`
- Model-generated interpretation: `It portrays truth as emerging or arising from the earth; the passage does not specify a further meaning.`
- SHA-256 integrity and the zero-based, end-exclusive UTF-8 registry byte range passed.
- The final quotation was reconstructed from the immutable registry rather than model text.
- The quotation was deterministically verified. The interpretation was model-generated and was not semantically verified. Sefaria, SHA-256, and the deterministic verifier did not validate the interpretation.
- The API key existed only in a process-scoped environment variable and was removed after the test. No API key, secret value, or OpenAI response message ID is recorded.

This release-gate run did not repeat the live request.

## Prior JPS corpus implementation files

New:

```text
prototype/ariel-demo/data/jps-1917-snapshot.json
prototype/ariel-demo/src/jps-1917-corpus.js
prototype/ariel-demo/src/source-canonicalization.js
prototype/ariel-demo/test/corpus.test.js
```

Updated:

```text
README.md
CHECKPOINT.md
docs/loop-engineering/FOUNDATION.md
prototype/ariel-demo/public/app.js
prototype/ariel-demo/public/index.html
prototype/ariel-demo/scripts/fake-demo.js
prototype/ariel-demo/scripts/live-smoke.js
prototype/ariel-demo/src/ariel-service.js
prototype/ariel-demo/src/demo-manifest.js
prototype/ariel-demo/src/errors.js
prototype/ariel-demo/src/model-clients.js
prototype/ariel-demo/src/model-contract.js
prototype/ariel-demo/test/manifest.test.js
prototype/ariel-demo/test/model-clients.test.js
prototype/ariel-demo/test/server.test.js
prototype/ariel-demo/test/service.test.js
```

`prototype/source-verification` is unchanged.

## Validation history and current release gates

- Baseline source-verifier suite: 51/51 passed; CLI exit 0.
- Baseline Ariel suite: 29/29 passed; old fake demo exit 0.
- JPS corpus Ariel suite: 43/43 passed.
- Interpretation-policy and current release Ariel suite: 44/44 passed.
- Updated fake demo: Psalm 85:12 verified, Proverbs 12:19 verified, transparent tampering blocked with `CLAIM_SUPPORT_INVALID` / `QUOTATION_MISMATCH`.
- Browser: desktop and 390px layouts rendered; verified and blocked paths displayed correct metadata; no horizontal overflow; no console warnings/errors.
- Independent provenance auditor reproduced exact title, license, text, byte lengths, ranges, and hashes from the two Sefaria endpoints.
- Current release source verifier: 51/51 passed; source CLI exit 0.
- Current release fake demo: Psalm 85:12 and Proverbs 12:19 verified; transparent tampering blocked with `CLAIM_SUPPORT_INVALID` / `QUOTATION_MISMATCH`.
- `git diff --check`: passed during implementation and the current release review.
- Runtime: Node.js `v24.12.0`, npm `11.11.0`.
- Dependencies: 0 runtime, 0 development; no install performed.
- Lint: unavailable; no script/configuration.
- Typecheck: unavailable; no script/configuration.
- Build: unavailable; no script/configuration.

## Prior corpus independent review

Final independent verdict: **ACCEPT**, with no actionable finding.

A fresh reviewer reopened every tracked and untracked JPS file and independently reproduced:

- Both exact authorized Sefaria responses, including the JPS 1917 title, `en` language, `Public Domain` license, `locked` status, empty warnings, and the absence of default-English or Revised JPS selection.
- Psalms canonical length 399 bytes, SHA-256 `0391d2350d08cac6bb8e535451f59f4606e132782c94b41799ca83e8da54a312`, ranges `[0, 82)`, `[83, 164)`, `[165, 246)`, `[247, 328)`, and `[329, 399)`; and Proverbs canonical length 87 bytes, range `[0, 87)`, and SHA-256 `1c577e59924bcad0b8b2b06016abc12d9e9ff3b841c463a1698ea551bdf70ed4`.
- Opaque enum-only model selection, server-held source evidence and metadata, verifier-evidence-only quotation publication, and successful transparent-tampering rejection.
- `max_output_tokens: 2000`, parsing only after `response.status === "completed"`, fail-closed incomplete handling with only the exact `incomplete_details.reason` retained, and the live-smoke status assertion.
- Required UI metadata and truthful caveats about semantic entailment, source authority, Sefaria's role, and SHA-256's byte-integrity scope.
- Source verifier 51/51, source CLI exit 0, Ariel 43/43, fake demo exit 0, `git diff --check` passing, and no `prototype/source-verification` diff.
- At that checkpoint no OpenAI live request had occurred; no credential value or unintended environment, log, temporary, lock, or dependency artifact was present.

## Release documentation review

Final independent verdict: **ACCEPT**, with no actionable finding.

The reviewer reopened the complete `README.md` and `CHECKPOINT.md` diff and confirmed:

- Every recorded live-validation fact matches the project-owner-supplied result, with no API key, secret value, or OpenAI response message ID included.
- Only the two authorized documentation files changed; no application behavior, source-verification code, test, schema, source record, or other file changed.
- Source verifier 51/51, Ariel 44/44, source CLI exit 0, fake demo exit 0, and `git diff --check` passed without rerunning the live request.
- Secret, credential, private-key, response-ID, and environment-file scans found no sensitive value or actual `.env`; the sole `.env`-named file is the pre-existing documentation-only `.env.example` with an empty `OPENAI_API_KEY=`.
- The documentation retains the bounded-corpus, no-semantic-proof, no-production-authentication/TLS/deployment, and SHA-256 byte-integrity-only limitations without implying production readiness or interpretation validation by Sefaria or the verifier.

## Remaining limitations

- Only two predefined JPS 1917 quotation options are registered; the demo corpus remains bounded.
- The API responses were manually selected and pinned; there is no authenticated/durable ingestion pipeline or raw-response archive.
- SHA-256 proves consistency with the pinned bytes, not source authority, legal advice, truth, or semantic entailment.
- Sefaria provides digital text and version/license metadata but does not verify the interpretation.
- The demo has no deterministic semantic-entailment proof; the interpretation remains model-generated.
- Registry/evidence are in memory; there is no production authentication, authorization, TLS termination, durable storage, rate limiting, telemetry, or production deployment.
- The live OpenAI path has one successful owner-supplied validation, not production reliability, security, availability, or monitoring evidence.
- The demo supports one citation per answer and is not production-ready.

## Current stopping point

After the documentation review and non-live gates pass, create the one authorized documentation commit and push only `feature/gpt-5.6-ariel-demo` to its configured `origin`. Stop there. Do not merge to `main`, deploy, tag, release, create an issue or pull request, or begin production/MVP integration.
