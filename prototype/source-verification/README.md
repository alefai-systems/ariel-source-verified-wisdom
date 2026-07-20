# Source-verification prototype

This isolated vertical slice implements the first Loop Engineering source gate in plain CommonJS using only Node.js standard-library modules. It does not modify or import the Ariel MVP.

## Contract decision

The foundation contract identifies snapshots by `(sourceId, sourceVersion)`, which can permit multiple immutable versions under one logical `sourceId`. This prototype intentionally adopts a stricter rule: one `sourceId` permanently binds exactly one `sourceVersion` and one exact `canonicalText`.

`sourceVersion` remains required in registrations, quotation claims, and evidence for compatibility and auditability. A changed source must receive a new `sourceId` and a new version. Repeating the same ID, version, and exact text is idempotent; reusing an ID with different text or a different version is a deterministic conflict. This is a prototype decision to be reviewed before integration, not a silent change to the foundation document.

## Guarantees

- The registry and every returned snapshot are frozen; adding a source returns a new registry.
- Canonical text, newlines, spaces, case, Unicode code points, combining marks, and RTL controls are preserved exactly.
- SHA-256 is recomputed over the exact UTF-8 bytes during every verification.
- Ranges are zero-based, end-exclusive UTF-8 byte offsets.
- Empty, negative, reversed, unsafe, fractional, out-of-bounds, and multibyte-splitting ranges fail closed.
- Extracted text must equal the declared quotation exactly; no trimming or normalization occurs.
- A higher-level claim needs at least one support, and every declared support must verify.
- A missing, throwing, or malformed resolver fails closed as `SOURCE_UNAVAILABLE` without exposing resolver errors or source content.
- Resolved identity is checked against the request and any caller-bound identity; UTF-8 byte length is derived from canonical bytes rather than trusted resolver metadata.
- Errors have stable codes, messages, and minimal relevant details. Failed results do not echo canonical source text or arbitrary input fields.

## Layout

```text
src/registry.js   persistent immutable source registry and SHA-256 snapshots
src/verifier.js   exact range, integrity, identity, and quotation checks
src/claims.js     all-declared-supports claim gate
src/errors.js     deterministic structured error results
cli/demo.js       visible Hebrew success and fail-closed examples
test/             Node built-in contract tests and synthetic fixtures
```

The Hebrew fixture is synthetic application text, not a biblical quotation. It covers Hebrew letters, a niqqud combining mark, spaces, a colon, Hebrew quotation marks, a question mark, parentheses, an RTL mark, and mixed Hebrew with numbers. Its exact target `עֵץ 42?` occupies UTF-8 bytes `[15, 25)`; `RTL` occupies `[44, 47)`.

## Run

No install step is required.

```powershell
cd C:\Projects\tree-a\prototype\source-verification
npm test
npm run demo
```

The CLI demonstrates immutable Hebrew registration, exact retrieval, a SHA-256 integrity pass, and expected rejection of a tampered quotation, an unknown ID, and a claim with no support.

## Public API

```js
const {
  ImmutableSourceRegistry,
  verifyQuotation,
  verifySupportedClaim,
} = require('./src');
```

Create a registry with records or use persistent `withSource(record)`. A quotation claim must include `sourceId`, `sourceVersion`, `hashAlgorithm: 'sha256'`, the registered `contentHash`, `offsetUnit: 'utf8-byte'`, `start`, `end`, and `quotation`. Successful results contain frozen reproducible evidence. Failures contain `{ ok: false, verifierVersion, error: { code, message, details } }`.

## Error codes

Registry conflicts use `SOURCE_ID_CONFLICT` and `SOURCE_VERSION_CONFLICT`. Verification rejects invalid identity, version, hash, integrity, identity binding, range, UTF-8 boundary, and quotation conditions with dedicated stable codes. Resolver interface failures, thrown lookup errors, and malformed snapshots use `SOURCE_UNAVAILABLE` with a stable reason and no underlying exception text. Claim gating adds `INVALID_CLAIM_ID`, `UNSUPPORTED_CLAIM`, and `CLAIM_SUPPORT_INVALID`.

This slice is deliberately in-memory and synchronous. Durable storage, ingestion authentication, concurrency, authorization, evidence persistence, state transitions, async/production resolver adapters, property-based and fuzz testing, CI, and Ariel integration remain documented limitations outside its boundary. They are not implied by the focused example suite.
