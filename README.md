# Ariel: Source-Verified Wisdom

Ariel is a local demonstration of a narrow trust rule: a language model may interpret a source and select a bounded reference, but it must not control the quotation ultimately shown to a user. The final quotation is reconstructed from immutable registered text and released only after deterministic identity, integrity, UTF-8 range, and exact-text checks pass.

This repository is an OpenAI Build Week prototype. It is not deployed and does not contain an Ariel production MVP.

## What is implemented

Two isolated, dependency-free Node.js prototypes now work together:

- `prototype/source-verification`: the existing deterministic registry, exact quotation verifier, and Claim Gate. Its original behavior and 51-test suite remain unchanged.
- `prototype/ariel-demo`: a loopback-only web UI, fake model, optional GPT-5.6 Responses API adapter, bounded reference manifest, post-model attack simulation, and offline integration/security tests.

The local demo provides:

- A question form and clear separation between model interpretation and registry quotation.
- An offline fake-model mode enabled by default.
- An optional server-side OpenAI adapter targeting `gpt-5.6-sol`, overridable with `OPENAI_MODEL`.
- Strict Structured Outputs through `text.format`.
- A pinned manifest with three allowed references into the existing synthetic Hebrew/Unicode fixture.
- Exact quote reconstruction from immutable registry bytes, followed by the existing `verifySupportedClaim` gate.
- A transparent simulation that alters quotation evidence after model generation and demonstrates a deterministic block.
- Fail-closed handling for missing configuration, transport errors, HTTP errors, timeouts, refusals, incomplete responses, malformed JSON, invalid model shapes, unknown references, invalid ranges, integrity failures, and unsupported claims.

## Trust architecture

```text
Browser question
  -> loopback-only Node server
  -> fake client OR GPT-5.6 Responses API
  -> strict model-output validation
  -> opaque reference token lookup in a server-held manifest
  -> exact UTF-8 quotation reconstruction from the immutable registry
  -> existing deterministic verifySupportedClaim()
  -> publish verifier evidence, or block without a quotation
```

| Boundary | Responsibility |
| --- | --- |
| Browser | Sends only a bounded question and the explicit tamper-simulation flag; renders model text with `textContent` |
| Model client | Returns an interpretation, support status, and at most one schema-enumerated `reference_id` |
| Server manifest | Maps each opaque token to pinned source identity, version, SHA-256, and a predefined UTF-8 byte range |
| Immutable registry | Preserves the exact canonical source text used for reconstruction |
| Claim Gate | Independently checks source identity/version, pinned integrity, range validity, UTF-8 boundaries, and exact quotation equality |

The model schema has no quotation, offset, hash, path, endpoint, model-name, or credential field. On success, `exactQuotation` is copied only from `verifySupportedClaim(...).claim.supports[0].extractedText`. Failed and unsupported results contain no `exactQuotation` property.

## Demo source and provenance

The demo directly imports the existing test fixture rather than creating a new source:

```text
sourceId: synthetic-hebrew-rtl
sourceVersion: v1
canonical text: מקור א: ״עֵץ 42?״ (בדיקה) ‏RTL
SHA-256: fcfa677dfcfc2fba40060ed481414634c53f103714a09799397b081b5fa0acbc
```

The primary demo reference uses zero-based, end-exclusive UTF-8 bytes `[15, 25)` and reconstructs `עֵץ 42?`. This is synthetic application test data, not a biblical quotation or an authoritative wisdom source. Its provenance is intentionally described no more strongly than the repository evidence supports.

## OpenAI Responses API design

Live mode performs one server-side `POST https://api.openai.com/v1/responses` using native `fetch`. The key is read only from `OPENAI_API_KEY` and placed only in the `Authorization` header. The request body has this exact structure:

```json
{
  "model": "gpt-5.6-sol",
  "store": false,
  "reasoning": { "effort": "low" },
  "max_output_tokens": 500,
  "input": [
    {
      "role": "developer",
      "content": [
        { "type": "input_text", "text": "<bounded instructions plus verified manifest>" }
      ]
    },
    {
      "role": "user",
      "content": [
        { "type": "input_text", "text": "<bounded user question>" }
      ]
    }
  ],
  "text": {
    "format": {
      "type": "json_schema",
      "name": "ariel_source_selection",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "interpretation": { "type": "string", "minLength": 1, "maxLength": 800 },
          "support_status": { "type": "string", "enum": ["supported", "unsupported"] },
          "citations": {
            "type": "array",
            "maxItems": 1,
            "items": {
              "type": "object",
              "properties": {
                "reference_id": {
                  "type": "string",
                  "enum": [
                    "fixture-quoted-segment",
                    "fixture-rtl-suffix",
                    "fixture-full-source"
                  ]
                }
              },
              "required": ["reference_id"],
              "additionalProperties": false
            }
          }
        },
        "required": ["interpretation", "support_status", "citations"],
        "additionalProperties": false
      }
    }
  }
}
```

`low` reasoning effort is deliberate for this small, latency-sensitive selection task. Output is bounded to 500 tokens. The adapter uses a 20-second timeout, performs no automatic retry, rejects partial or ambiguous output, and never repairs code-fenced or malformed JSON. Official design references: [GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), and the [Responses create reference](https://developers.openai.com/api/reference/resources/responses/methods/create).

## Prerequisites and installation

The verified environment uses Node.js `v24.12.0`. Both packages use only Node.js built-ins and native `fetch`.

There is no dependency installation step. Do not run `npm install`.

`.env.example` documents supported variables, but the application deliberately does not load `.env` files. Set variables in the server process environment.

## Run the local web demo

Fake mode is the default and makes no external request:

```powershell
cd C:\Projects\tree-a\prototype\ariel-demo
node .\src\server.js
```

Open `http://127.0.0.1:3000`. Check **Simulate post-model tampering** to see the application alter evidence after the fake model returns and the Claim Gate block it. This is explicitly an application-injected test, not a claim that the model attacked its citation.

Equivalent package command:

```powershell
npm start
```

## Run all offline verification

Existing deterministic verifier:

```powershell
cd C:\Projects\tree-a\prototype\source-verification
node --test
node .\cli\demo.js
```

New Ariel demo:

```powershell
cd C:\Projects\tree-a\prototype\ariel-demo
node --test
node .\scripts\fake-demo.js
```

No lint, typecheck, or build script is defined in either package. Those checks are unavailable rather than claimed as passing.

## Optional live smoke test

Run a live request only when you intentionally provide a key. The following PowerShell commands keep it in the current process environment and remove it afterward:

```powershell
cd C:\Projects\tree-a\prototype\ariel-demo
$env:OPENAI_API_KEY = Read-Host "OpenAI API key" -MaskInput
$env:OPENAI_MODEL = "gpt-5.6-sol"
node .\scripts\live-smoke.js
Remove-Item Env:OPENAI_API_KEY
Remove-Item Env:OPENAI_MODEL
```

To run the browser demo in live mode instead:

```powershell
cd C:\Projects\tree-a\prototype\ariel-demo
$env:OPENAI_API_KEY = Read-Host "OpenAI API key" -MaskInput
$env:OPENAI_MODEL = "gpt-5.6-sol"
$env:ARIEL_MODEL_PROVIDER = "openai"
node .\src\server.js
```

Stop the server, then remove the three environment variables. The browser cannot select fake/live mode, model, endpoint, or credentials.

## Current verified results

Verified locally on 2026-07-21 without an API key:

- Existing verifier: 51 tests passed, 0 failed.
- Existing CLI: exit code 0 with exact Hebrew retrieval/integrity success and all documented rejection demonstrations passing.
- Ariel demo: 29 tests passed, 0 failed.
- Offline fake-model HTTP demo: verified `fixture-quoted-segment` as `עֵץ 42?`; post-model tampering was blocked as `CLAIM_SUPPORT_INVALID` caused by `QUOTATION_MISMATCH`.
- Browser check: fake runtime loaded with no console errors; desktop and 390px layouts rendered; verified and blocked interactions both behaved as documented.
- Live smoke test: not run because `OPENAI_API_KEY` was absent.
- External runtime and development dependencies: 0.

## Security properties

- The server binds to `127.0.0.1` and serves only three allowlisted static routes plus two JSON endpoints.
- Live/fake mode, model, endpoint, and API key are startup configuration, never browser-controlled input.
- The API key is held in a private server field, never added to a prompt, response, static asset, or log.
- JSON requests and model output are byte-bounded. Browser request keys and model response keys are allowlisted.
- POST requests must name the actual loopback socket and port; cross-origin and matching non-loopback Host/Origin requests are rejected, and no permissive CORS header is emitted.
- Responses include a restrictive Content Security Policy and are always `no-store`.
- Upstream errors, bodies, exception messages, stacks, headers, and refusal text are not returned to the browser.
- A sentinel-key integration test checks successful responses, error responses, status JSON, HTML, and JavaScript for credential leakage.

## How OpenAI Codex was used

OpenAI Codex inspected the verified repository baseline, read the existing verifier and all tests, checked current official OpenAI API guidance, created the isolated feature branch, implemented the add-only demo, wrote offline contract/security tests, and exercised the real local UI. Separate read-only agents reviewed the architecture and API/security boundary. The final independent reviewer returned one loopback Host-validation issue; after correction and a DNS-rebinding regression, the reviewer accepted the checkpoint.

## Repository structure

```text
tree-a/
├── .env.example
├── .gitattributes
├── .gitignore
├── AGENTS.md
├── CHECKPOINT.md
├── README.md
├── docs/loop-engineering/
├── prototype/source-verification/
│   ├── cli/
│   ├── src/
│   └── test/
└── prototype/ariel-demo/
    ├── package.json
    ├── public/
    ├── scripts/
    ├── src/
    └── test/
```

## OpenAI Build Week context

This milestone creates a small, demonstrable vertical slice for Build Week: model interpretation is useful but visibly separated from deterministic source evidence. The safest next product path is to replace the synthetic fixture with an authenticated, licensed, versioned source ingestion adapter and add semantic-evaluation coverage before any production or public deployment work.

## Known limitations

- The only source is synthetic test data with no claim to external authority, licensing, or provenance.
- SHA-256 and exact range verification prove byte consistency, not source authority or truth.
- The Claim Gate verifies declared exact support but does not determine whether model prose is semantically entailed by that quotation.
- Sources, evidence, and requests are in-memory and synchronous apart from the model request; nothing is persisted across restarts.
- There is no authentication, authorization, durable source store, ingestion pipeline, rate limiting, CI, telemetry, deployment configuration, or production adapter.
- The live OpenAI code path is implemented and fully mocked in tests, but it has not been exercised against the API in this checkpoint because no key was present.
- The demo deliberately supports one citation per answer and three predefined ranges from one fixture.
- No Ariel product MVP was present to integrate with or modify.

## License status

No license has been selected or added. Do not assume that this repository grants permission to use, modify, or redistribute its contents.
