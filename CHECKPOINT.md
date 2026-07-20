# Safe checkpoint handoff

Checkpoint sealed: 2026-07-21 01:24:13 +03:00, Asia/Hebron.

Work stops at a complete local Build Week demonstration. Do not resume or begin the next task without an explicit instruction.

## Objective completed

Build the first working local Ariel: Source-Verified Wisdom web demonstration using an optional GPT-5.6 Responses API adapter and the existing deterministic Tree A verifier, while keeping final quotation text outside model control.

## Git boundary

- Feature branch: `feature/gpt-5.6-ariel-demo`.
- Verified parent/base: `d32cfb44cd86888c99bbc9a2ee3574c6e795fbc0` on `main` and `origin/main`.
- The branch was created only after `git fetch origin main` confirmed 0 ahead / 0 behind, a clean tree, the exact required base hash, 51 passing tests, and CLI exit 0.
- The requested checkpoint is one local commit with message `feat: add GPT-5.6 source-verified Ariel demo`. Its hash is reported in the external handoff because a commit cannot reliably embed its own hash.
- The feature branch has no upstream and was not pushed. No tag, release, issue, pull request, deployment, or GitHub mutation was created.

## Protected existing implementation

Every file under `prototype/source-verification` remains unchanged from `main`. The demo imports only its public module and exact existing synthetic fixture. The existing 51-test behavior and CLI output remain intact.

No Ariel product MVP was present in this repository, so none was accessed or modified.

## Files added

```text
.env.example
prototype/ariel-demo/package.json
prototype/ariel-demo/public/app.js
prototype/ariel-demo/public/index.html
prototype/ariel-demo/public/styles.css
prototype/ariel-demo/scripts/fake-demo.js
prototype/ariel-demo/scripts/live-smoke.js
prototype/ariel-demo/src/ariel-service.js
prototype/ariel-demo/src/demo-manifest.js
prototype/ariel-demo/src/errors.js
prototype/ariel-demo/src/model-clients.js
prototype/ariel-demo/src/model-contract.js
prototype/ariel-demo/src/server.js
prototype/ariel-demo/test/manifest.test.js
prototype/ariel-demo/test/model-clients.test.js
prototype/ariel-demo/test/server.test.js
prototype/ariel-demo/test/service.test.js
```

## Files updated

- `README.md`: implemented architecture, exact Responses API design, setup, tests, live smoke instructions, security, provenance, Build Week context, and limitations.
- `docs/loop-engineering/FOUNDATION.md`: current local-demo architecture, corrected Git/product risks, validation, and ordered future gates.
- `CHECKPOINT.md`: this handoff.

## Architecture and trust boundary

1. The browser sends only a bounded question and an optional, explicitly labeled tamper-simulation flag to a loopback server.
2. The default fake client or optional server-side GPT-5.6 client returns a strict structure: interpretation, support status, and at most one opaque `reference_id`.
3. The schema cannot carry quotation text, ranges, hashes, paths, endpoints, model configuration, or credentials.
4. The server resolves the token through a frozen manifest pinning `sourceId`, `sourceVersion`, SHA-256, and a predefined UTF-8 byte range.
5. Exact text is reconstructed from the immutable source registry and submitted to the existing `verifySupportedClaim` gate.
6. The browser receives `exactQuotation` only from successful verifier evidence. Unsupported, invalid, unavailable, and tampered paths contain no `exactQuotation` property.

The primary source is the existing synthetic fixture `synthetic-hebrew-rtl@v1`, pinned to SHA-256 `fcfa677dfcfc2fba40060ed481414634c53f103714a09799397b081b5fa0acbc`. Range `[15, 25)` reconstructs `עֵץ 42?`. It is transparently labeled synthetic test data with no authoritative provenance claim.

## OpenAI adapter

- Endpoint: `POST https://api.openai.com/v1/responses`.
- Default model: `gpt-5.6-sol`; server-side `OPENAI_MODEL` override supported.
- `store: false`.
- Strict JSON Schema through `text.format`.
- Deliberate `reasoning.effort: low` for this bounded, latency-sensitive demo.
- `max_output_tokens: 500`.
- Native `fetch`, 20-second abort timeout, no retry, and no external package.
- Refusals, incomplete responses, HTTP failures, network failures, invalid JSON, ambiguous output blocks, oversized output, and malformed structures all fail closed.
- `OPENAI_API_KEY` is read only from the server environment, held in a private client field, placed only in the Authorization header, and absent from public runtime configuration, prompts, responses, assets, and logs.

No live request ran because `OPENAI_API_KEY` was absent. All OpenAI tests used injected fetch doubles.

## Exact validation results

Commands from `prototype/source-verification`:

```powershell
node --test
node .\cli\demo.js
```

- Existing suite: 51 tests, 51 passed, 0 failed, exit 0.
- Existing CLI: exit 0; exact Hebrew retrieval and SHA-256 integrity passed; tampered quotation, unknown source, and unsupported claim were rejected with the expected codes.

Commands from `prototype/ariel-demo`:

```powershell
node --test
node .\scripts\fake-demo.js
```

- Ariel suite: 29 tests, 29 passed, 0 failed, exit 0.
- Fake HTTP demo: exit 0; `fixture-quoted-segment` verified as `עֵץ 42?`; transparent post-model tampering blocked as `CLAIM_SUPPORT_INVALID` caused by `QUOTATION_MISMATCH`.
- Browser: desktop and 390px responsive layouts rendered; verified and blocked interactions matched the API results; no console warning/error was present.
- JavaScript syntax and package JSON audit: passed.
- `git diff --check`: passed.
- Final-newline, trailing-whitespace, merge-marker, unexpected-artifact, and common secret-pattern audits: passed.
- Runtime: Node.js `v24.12.0`, npm `11.11.0`.
- Dependencies: 0 runtime, 0 development; no lockfile or `node_modules`.
- Lint: unavailable; no script or configuration exists.
- Typecheck: unavailable; no script or configuration exists.
- Build: unavailable; no script or configuration exists.

## Independent review

The final read-only reviewer reopened all files and reran the raw gates. The first verdict was **RETURN** for one P1: origin validation reflected the client-controlled `Host`, allowing a DNS-rebinding authority to match itself and potentially consume a live server key.

Correction:

- POST authority validation now requires the actual request socket port and only `127.0.0.1` or `localhost`.
- Origin, when present, must exactly match that approved authority.
- Missing Origin remains intentionally supported only with a valid loopback Host for local non-browser clients.
- A matching non-loopback Host/Origin regression requires HTTP 400 and verifies zero model calls.

The targeted independent re-review verdict was **ACCEPT** with 29/29 tests passing, `git diff --check` passing, and no remaining actionable finding.

## Security and truthfulness review

- Model-selected references are schema-enumerated opaque tokens; invalid cross-products cannot be supplied.
- Manifest identity, version, hash, and ranges are server-held and pinned.
- Final quote publication is exclusively verifier-evidence-derived.
- A model-supplied `quotation` property invalidates the whole response.
- Unknown source, invalid range, altered source, tampered quote, malformed model output, and unsupported claim tests all fail closed without a quotation.
- Browser rendering uses `textContent`, restrictive CSP headers, no permissive CORS, bounded JSON, allowlisted routes, and loopback Host/Origin validation.
- Sentinel tests prove server key absence from status, success/error response bodies, HTML, JavaScript, and public runtime configuration.
- The UI and documentation distinguish model interpretation from exact source verification and explicitly state that semantic entailment and source authority are not proven.

## Remaining limitations

- The only source is synthetic application test data.
- SHA-256 proves byte consistency, not authority, licensing, provenance, truth, or semantic entailment.
- The live adapter is implemented and mocked but not exercised against OpenAI in this checkpoint.
- Registry and evidence are in-memory; there is no durable/authenticated ingestion or storage.
- There is no authentication, authorization, rate limiting, CI, telemetry, deployment configuration, or production integration.
- The demo deliberately supports one citation per answer and three predefined ranges.

## Safest next task

When explicitly instructed and a key is intentionally present, run the documented single live smoke command, inspect only sanitized output, and record the result without changing the verifier contract. Do not deploy or begin product/MVP integration. After live compatibility is confirmed, the next engineering milestone should define an authenticated, licensed, versioned real-source ingestion boundary plus semantic-evaluation coverage.
