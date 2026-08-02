# Ariel: Source-Verified Wisdom

## 🎥 Demo

**Watch the video:** https://youtu.be/HiJKXAAFoeI

Submitted to [OpenAI Build Week](https://openai.devpost.com/) — July 2026.

Ariel is a local demonstration of one narrow trust rule: a language model may interpret pinned source material and select an allowed reference, but it must not control the quotation ultimately shown to a user. The final quotation is reconstructed from immutable registered text and released only after deterministic source identity, SHA-256, UTF-8 range, and exact-text checks pass.

This repository is an OpenAI Build Week prototype. It is not deployed and does not contain a production Ariel MVP.

Large language models can produce plausible but inexact quotations. Ariel separates model interpretation from displayed evidence. The model may return an interpretation, support status, and an allowlisted opaque reference. Displayed quotations are reconstructed only from the pinned, SHA-256-verified registry and are blocked if deterministic verification fails.

## Open-source relevance

Ariel is a reusable architectural pattern for systems where exact source attribution matters: model interpretation remains separate from source evidence, and displayed quotations are released only after deterministic verification. The pattern may be generalized to other domains, but this prototype is not ready for legal, medical, or production use.

## Quick start

Run these commands from the repository root in PowerShell. Node.js and npm are required. Both packages use only Node.js built-ins and native `fetch`.

There is no dependency installation step. Do not run `npm install`.

Run the two test suites and offline demos from the repository root:

```powershell
cd prototype\source-verification
npm test
node .\cli\demo.js

cd ..\ariel-demo
npm test
node .\scripts\fake-demo.js
```

## What is implemented

Two dependency-free Node.js prototypes work together:

- `prototype/source-verification`: the existing immutable registry, exact quotation verifier, and Claim Gate. Its behavior and 51-test suite remain unchanged.
- `prototype/ariel-demo`: a loopback-only web UI, deterministic fake model, optional GPT-5.6 Responses API adapter, pinned JPS 1917 corpus, opaque reference manifest, transparent post-model attack simulation, and offline contract/security tests.

The Ariel demo provides:

- Two pinned English sources from **The Holy Scriptures: A New Translation (JPS 1917)**, returned by Sefaria with license **Public Domain**.
- One registered multi-segment source for Psalms 85:10-14, with Psalm 85:12 derived programmatically as the primary quotation range.
- Proverbs 12:19 as a second bounded source.
- An offline fake-model mode enabled by default.
- An optional server-side OpenAI adapter targeting `gpt-5.6-sol`, overridable with `OPENAI_MODEL`.
- Strict Structured Outputs through `text.format`, with only interpretation, support status, and one enum-bounded opaque reference token.
- Exact quotation reconstruction from immutable registry bytes followed by the existing `verifySupportedClaim` gate.
- A transparent simulation that alters quotation evidence after model generation and demonstrates a deterministic block.

## Trust architecture

```text
Browser question
  -> loopback-only Node server
  -> fake client OR GPT-5.6 Responses API
  -> require response.status === "completed"
  -> strict model-output validation
  -> opaque reference-token lookup in a server-held manifest
  -> exact UTF-8 quotation reconstruction from the immutable registry
  -> existing deterministic verifySupportedClaim()
  -> publish verifier evidence, or block without a quotation
```

| Boundary | Responsibility |
| --- | --- |
| Browser | Sends only a bounded question and explicit tamper-simulation flag; renders text with `textContent` |
| Model client | Returns an interpretation, support status, and at most one schema-enumerated `reference_id` |
| Server manifest | Maps `jps-source-a` or `jps-source-b` to a pinned source identity, content-addressed version, SHA-256, and predefined UTF-8 byte range |
| Immutable registry | Preserves the final canonical source text used for quotation reconstruction |
| Claim Gate | Checks source identity/version, pinned integrity, range validity, UTF-8 boundaries, and exact quotation equality |

The model schema has no quotation, offset, hash, source metadata, URL, endpoint, model-name, or credential field. The model receives excerpt context paired with opaque tokens but never controls their server-side identity/range mapping. On success, `exactQuotation` is copied only from `verifySupportedClaim(...).claim.supports[0].extractedText`. Failed and unsupported results contain no `exactQuotation` property.

## Pinned JPS 1917 source corpus

Only these Sefaria Texts v3 endpoints were requested:

1. [Psalms 85:10-14, exact JPS 1917 version](https://www.sefaria.org/api/v3/texts/Psalms.85.10-14?version=english%7CThe%20Holy%20Scriptures%3A%20A%20New%20Translation%20%28JPS%201917%29&return_format=text_only&fill_in_missing_segments=0)
2. [Proverbs 12:19, exact JPS 1917 version](https://www.sefaria.org/api/v3/texts/Proverbs.12.19?version=english%7CThe%20Holy%20Scriptures%3A%20A%20New%20Translation%20%28JPS%201917%29&return_format=text_only&fill_in_missing_segments=0)

Both requests explicitly used:

```text
version=english|The Holy Scriptures: A New Translation (JPS 1917)
return_format=text_only
fill_in_missing_segments=0
```

Each response selected exactly one version with:

```text
versionTitle: The Holy Scriptures: A New Translation (JPS 1917)
language: en
actualLanguage: en
license: Public Domain
status: locked
warnings: []
```

Psalms returned exactly five non-empty segments and Proverbs returned one non-empty string. No default English version, Revised JPS 2023 text, missing segment, warning, reference substitution, or license substitution was accepted.

Attribution shown by the demo:

> Text: The Holy Scriptures: A New Translation (JPS 1917), Public Domain. Digital text via Sefaria.

Sefaria provides the digital text and edition metadata; it does not verify Ariel's model interpretation. SHA-256 detects changes to the pinned bytes; it does not prove source authority or semantic truth.

### Canonicalization

The deterministic `ariel-sefaria-text-v1` pipeline is:

1. Decode HTML entities.
2. Replace `br` elements and line breaks with a single space.
3. Remove remaining HTML tags.
4. Normalize Unicode to NFC.
5. Trim leading and trailing whitespace.
6. Collapse internal whitespace to one space.
7. Preserve capitalization and punctuation exactly.
8. Encode the final canonical text as UTF-8.
9. Calculate SHA-256 over those final stored UTF-8 bytes.

Each API segment is canonicalized independently. Multi-segment sources retain API order and join segments with one ASCII space (`U+0020`). The audited selected text required no textual change, but the pipeline and HTML/entity/NFC/break behavior are covered by deterministic tests.

### Stored metadata and ranges

Retrieval checkpoint: `2026-07-21T04:51:44.8906045+03:00`.

| Registered source | Metadata |
| --- | --- |
| `jps-1917-psalms-85-10-14` | Reference `Psalms 85:10-14`; content-addressed version `sha256:0391d235…54a312`; 399 UTF-8 bytes; SHA-256 `0391d2350d08cac6bb8e535451f59f4606e132782c94b41799ca83e8da54a312` |
| `jps-1917-proverbs-12-19` | Reference `Proverbs 12:19`; content-addressed version `sha256:1c577e59…f70ed4`; 87 UTF-8 bytes; SHA-256 `1c577e59924bcad0b8b2b06016abc12d9e9ff3b841c463a1698ea551bdf70ed4` |

Psalms segment ranges are derived by accumulating UTF-8 byte lengths plus one joining-space byte; offsets are zero-based and end-exclusive:

| Segment | Range |
| --- | --- |
| Psalms 85:10 | `[0, 82)` |
| Psalms 85:11 | `[83, 164)` |
| Psalms 85:12 | `[165, 246)` |
| Psalms 85:13 | `[247, 328)` |
| Psalms 85:14 | `[329, 399)` |

The primary verified quotation is Psalms 85:12, with alternate display reference **Psalm 85:11 (common Christian/KJV numbering)**:

> Truth springeth out of the earth; And righteousness hath looked down from heaven.

Proverbs 12:19 uses `[0, 87)`:

> The lip of truth shall be established for ever; But a lying tongue is but for a moment.

The committed source snapshot preserves `sourceId`, reference and applicable alternate reference, version title, language, license and license note, provider, exact endpoint, retrieval checkpoint, normalization contract, SHA-256, and all segment references/ranges.

## OpenAI Responses API design

Live mode performs one server-side `POST https://api.openai.com/v1/responses` using native `fetch`. The key is read only from `OPENAI_API_KEY` and placed only in the `Authorization` header. The relevant request fields are:

```json
{
  "model": "gpt-5.6-sol",
  "store": false,
  "reasoning": { "effort": "low" },
  "max_output_tokens": 2000,
  "input": [
    { "role": "developer", "content": [{ "type": "input_text", "text": "<bounded instructions and excerpt manifest>" }] },
    { "role": "user", "content": [{ "type": "input_text", "text": "<bounded question>" }] }
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
                "reference_id": { "type": "string", "enum": ["jps-source-a", "jps-source-b"] }
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

The adapter requires `response.status === "completed"` before parsing any output. For `status: "incomplete"`, it fails with `MODEL_INCOMPLETE` and preserves only the exact `incomplete_details.reason`; the live-smoke CLI renders that value with `JSON.stringify` to avoid log injection. Every other non-completed status fails closed. The adapter uses a 20-second timeout, makes no automatic retry, and rejects refusals, partial output, ambiguous blocks, oversized output, code fences, invalid JSON, and extra schema fields.

## Prerequisites and installation

The verified environment uses Node.js `v24.12.0` and npm `11.11.0`. Both packages use only Node.js built-ins and native `fetch`.

There is no dependency installation step. Do not run `npm install`.

`.env.example` documents supported variables, but the application does not load `.env` files. Set variables only in the server process environment.

### Run the local web demo

Fake mode is the default and makes no external request:

```powershell
cd prototype\ariel-demo
node .\src\server.js
```

Open `http://127.0.0.1:3000`. Check **Simulate post-model tampering** to see application-injected evidence alteration blocked by Claim Gate. The model does not perform that simulated attack.

### Run all offline verification

```powershell
cd prototype\source-verification
npm test
node .\cli\demo.js

cd ..\ariel-demo
npm test
node .\scripts\fake-demo.js
```

No lint, typecheck, or build script is defined in either package. Those checks are unavailable rather than claimed as passing.

## Live smoke validation

On 2026-07-21, the project owner successfully ran `prototype/ariel-demo/scripts/live-smoke.js` against OpenAI with model `gpt-5.6-sol`. The key was supplied only through a process-scoped environment variable and removed after the test. No API key, secret value, or OpenAI response message ID is stored in this repository or recorded here.

The sanitized observed result was:

- Responses API status: `completed`.
- Ariel outcome: `verified`.
- GPT selected an opaque allowed reference, which the server resolved to `Psalms 85:12` in the registered `Psalms 85:10-14` source.
- Version: **The Holy Scriptures: A New Translation (JPS 1917)**; digital text provider: Sefaria; recorded license: **Public Domain**.
- SHA-256 integrity and the registry's zero-based, end-exclusive UTF-8 byte range both passed.
- The final quotation was reconstructed from the immutable registry:

> Truth springeth out of the earth; And righteousness hath looked down from heaven.

- Model-generated interpretation: “It portrays truth as emerging or arising from the earth; the passage does not specify a further meaning.”

The quotation was deterministically verified. The interpretation remained model-generated and was not semantically verified. Neither Sefaria, SHA-256, nor the deterministic verifier validated the interpretation.

For any separately authorized rerun, keep the key process-local:

```powershell
cd prototype\ariel-demo
$env:OPENAI_API_KEY = Read-Host "OpenAI API key" -MaskInput
$env:OPENAI_MODEL = "gpt-5.6-sol"
try {
  node .\scripts\live-smoke.js
}
finally {
  Remove-Item Env:OPENAI_API_KEY
  Remove-Item Env:OPENAI_MODEL
}
```

The command succeeds only for an accepted Claim Gate result backed by an OpenAI response whose status is exactly `completed`. An incomplete response exits nonzero and reports `incomplete_details.reason` exactly.

## Current verified results

Verified on 2026-07-21. The release-gate commands were run without making another OpenAI request:

- Existing source verifier: 51 tests passed, 0 failed.
- Existing source-verifier CLI: exit 0 with all documented success/rejection demonstrations passing.
- Ariel demo: 44 tests passed, 0 failed.
- Fake-model HTTP demo: both Psalm 85:12 and Proverbs 12:19 verified; post-model tampering blocked as `CLAIM_SUPPORT_INVALID` caused by `QUOTATION_MISMATCH`.
- Browser: desktop and 390px layouts rendered without horizontal overflow; verified and blocked paths displayed the required metadata; no console warning/error was present.
- Independent Sefaria provenance reproduction: passed for version, language, license, reference, completeness, canonical text, ranges, and hashes.
- Owner-supplied OpenAI live smoke: `gpt-5.6-sol`, response status `completed`, Ariel outcome `verified`, opaque reference resolved to Psalms 85:12, immutable-registry quotation and integrity/range checks passed.
- Runtime and development dependencies: 0.

## Security and truthfulness properties

- The server binds to `127.0.0.1` and serves only allowlisted static routes and JSON endpoints.
- Live/fake mode, model, endpoint, and API key are server startup configuration, never browser-controlled input.
- The API key is held in a private server field and never added to prompts, responses, assets, or logs. The successful live validation used a process-scoped key that was removed after the test; no key is stored in the repository.
- The source snapshot fails closed on version selector, title, language, license, endpoint, reference, segment order/completeness, warning, or byte/hash drift.
- Model output keys and reference tokens are allowlisted; source metadata cannot be supplied by the model.
- POST requests must name the actual loopback socket and port; cross-origin and matching non-loopback Host/Origin requests are rejected.
- Responses use a restrictive Content Security Policy and `no-store`.
- Upstream bodies, exception messages, stacks, headers, and refusal text are not returned to the browser.
- The UI and documentation distinguish model interpretation, Sefaria-provided metadata, byte integrity, and semantic/source authority.

## Repository structure

```text
tree-a/
├── CHECKPOINT.md
├── README.md
├── docs/loop-engineering/
├── prototype/source-verification/
│   ├── cli/
│   ├── src/
│   └── test/
└── prototype/ariel-demo/
    ├── data/jps-1917-snapshot.json
    ├── public/
    ├── scripts/
    ├── src/
    └── test/
```

## OpenAI Build Week context

This milestone replaces the synthetic demo fixture with a small, reproducible public-domain source corpus while preserving the trust boundary between model interpretation and deterministic quotation. It remains a demonstration, not a source-authority, legal-determination, or semantic-entailment system.

## Known limitations

- The demo corpus is bounded to two predefined quotation options from one retrieved JPS 1917 snapshot.
- The source snapshot was manually pinned from verified Sefaria API responses; there is no authenticated or durable ingestion pipeline.
- SHA-256 proves consistency with the locally pinned bytes, not source authority, continuing upstream availability, legal advice, truth, or semantic entailment.
- Sefaria provides text and version/license metadata but does not verify the model interpretation.
- The demo has no deterministic semantic-entailment proof; prompt constraints and one successful live response do not establish semantic correctness.
- Sources and evidence are in memory; nothing is persisted across restarts.
- There is no production authentication, authorization, TLS termination, rate limiting, telemetry, or production deployment. The server remains a loopback-only demonstration.
- The live OpenAI path has one successful owner-supplied validation, not production reliability, security, availability, or monitoring evidence.
- The demo supports one citation per answer and is not production-ready.

## Contributing

Focused issues and pull requests are welcome. Contributions must preserve fail-closed behavior, separation between model output and source evidence, deterministic verification, and truthful test and security claims.

## License

Repository code and documentation are licensed under MIT; see [LICENSE](LICENSE).

The included JPS 1917 source text is **Public Domain**. Digital text and edition metadata were obtained through Sefaria. Sefaria does not endorse or verify Ariel's interpretations.
