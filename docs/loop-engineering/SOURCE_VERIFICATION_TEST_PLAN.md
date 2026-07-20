# Automated test plan: source identity and exact quotation ranges

Status: partially executable. The isolated Node.js prototype at `prototype/source-verification` implements the task-mandated first slice; the broader conformance and integration cases below remain the plan.

## Current implementation coverage

The prototype uses `node:test` with no external dependencies. After independent review and a focused correction pass, `node --test` reported 51 tests, 51 passed, and 0 failed. All 20 cases mandated for the first executable slice have direct coverage, including deterministic successful reruns and explicit one-character deletion/addition rejection.

Implemented coverage includes immutable registration, identity/version validation, SHA-256 integrity, UTF-8 byte ranges, Hebrew and niqqud preservation, CRLF and normalization differences, structured resolver failures, exact quotation matching, and fail-closed claim supports.

Still planned rather than claimed complete: decoding every authoritative hex fixture below into executable conformance data, non-BMP and duplicate-occurrence cases, generated property/mutation tests, durable-store integration, state transitions, CI, and product/Ariel adapters.

## Test objective

Prove that a quotation is accepted only when its stable, versioned source resolves uniquely and its declared range extracts exactly the claimed text from immutable canonical content.

## Harness shape

The deterministic in-memory contract harness now exists in the isolated prototype. Keep the core verifier pure while extending it with the remaining cases below; add source-store and product integration tests separately only after their real architecture is available.

The harness needs three observable operations:

1. Validate non-empty string identity fields and resolve exactly one snapshot from the case-sensitive `(sourceId, sourceVersion)` pair.
2. Encode canonical text as UTF-8, validate character boundaries, and slice by zero-based, end-exclusive byte offsets.
3. Verify the expected hash, bounds, and exact quotation equality without transformations.

Every failure assertion should check the stable reason code and confirm that no verified claim is emitted.

## Deterministic fixtures

Create fixtures from the following authoritative UTF-8 bytes. Display notation uses `\r`, `\n`, and `\u0301` only to make control or combining characters visible; those escape characters are not fixture content. The harness must decode the listed hex, assert the byte length and SHA-256 hash, and then expose the decoded text.

| Fixture | Display notation | Bytes | UTF-8 hex | SHA-256 |
| --- | --- | ---: | --- | --- |
| ASCII | `Tree A cites sources.` | 21 | `54 72 65 65 20 41 20 63 69 74 65 73 20 73 6F 75 72 63 65 73 2E` | `2F47FB5E2DBE5D4CA532DF028092D37CEAFDF889AABBEAE35C01071EABDD8DCA` |
| Hebrew | `עץ א מצטט מקור.` | 26 | `D7 A2 D7 A5 20 D7 90 20 D7 9E D7 A6 D7 98 D7 98 20 D7 9E D7 A7 D7 95 D7 A8 2E` | `9F5F3295681085A91D53DC709D444329A42E1341F488D4F553A6CCB7C3B39B16` |
| Whitespace | `  exact text  ` | 14 | `20 20 65 78 61 63 74 20 74 65 78 74 20 20` | `C838C480FB508BA5DEB7E05C06C541A477FE15568C4A92676F7731621D1944C0` |
| CRLF | `first\r\nsecond` | 13 | `66 69 72 73 74 0D 0A 73 65 63 6F 6E 64` | `D930E679A8CA94308FB7400EEA7B82500CC7EA08EFF0C1484E065E4A5F6145D0` |
| LF | `first\nsecond` | 12 | `66 69 72 73 74 0A 73 65 63 6F 6E 64` | `4252F8D56B4BB236D0B1BC95A1202E392CA84CE0644BF628398FBB9517287DA8` |
| Non-BMP | `A🌳B` | 6 | `41 F0 9F 8C B3 42` | `7F3C3A97D5856704F73DD9E4A88E3CD607501405AB9FC259277F2BEC745B2E13` |
| Combining | `Cafe\u0301` | 6 | `43 61 66 65 CC 81` | `C42CC7A1CA08364B6FD859FA50D2454730A8236290A423373CC630DA77C6D711` |
| Precomposed | `Café` | 5 | `43 61 66 C3 A9` | `73473DCC12B763085904A5279D048C4D5B3B008C46F1F32443B99DE04AA83A14` |

Assign every fixture a distinct `sourceId` and version. The combining, precomposed, CRLF, and LF fixtures must remain distinct even when a renderer makes them look similar.

## Required contract cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| SID-01 | Known non-empty `sourceId` and current version resolve once | Accepted if all other gates pass |
| SID-02 | Missing, non-string, empty, or whitespace-only `sourceId` | `INVALID_SOURCE_ID` |
| SID-03 | Unknown `sourceId` | `UNKNOWN_SOURCE` |
| SID-04 | Duplicate/ambiguous resolution in a corrupted fixture store | `AMBIGUOUS_SOURCE` |
| SID-05 | Missing, non-string, empty, or whitespace-only `sourceVersion` | `INVALID_SOURCE_VERSION` |
| SID-06 | Known ID with a well-formed version that is unknown or no longer retrievable | `STALE_SOURCE_VERSION` |
| SID-07 | Another ID/version contains the same bytes and the claim is self-consistent | Core verifier accepts; identity is part of the verified evidence |
| SID-08 | Caller binds expected ID/version A but receives a valid claim for B | `SOURCE_IDENTITY_MISMATCH` |
| SID-09 | Source content no longer matches the expected hash | `SOURCE_INTEGRITY_MISMATCH` |
| SID-10 | Registered string ID or version `"0"` is supplied | Treated as a valid non-empty identity, not as missing |
| SID-11 | Case differs from the registered ID or version | Does not resolve; identity comparison is case-sensitive |
| RNG-01 | Full range `[0, length)` | Exact full text accepted |
| RNG-02 | Valid range at the beginning | Exact prefix accepted |
| RNG-03 | Valid range ending at `length` | Exact suffix accepted |
| RNG-04 | `start` or `end` is non-integer, missing, NaN, or infinite | `INVALID_RANGE` |
| RNG-05 | Negative `start` | `INVALID_RANGE` |
| RNG-06 | `start == end` empty quotation | `INVALID_RANGE` |
| RNG-07 | `start > end` | `INVALID_RANGE` |
| RNG-08 | `end > length` | `RANGE_OUT_OF_BOUNDS` |
| RNG-09 | Offset unit missing or unsupported | `INVALID_RANGE` |
| RNG-10 | Start or end splits a multi-byte UTF-8 sequence | `RANGE_NOT_UTF8_BOUNDARY` |
| TXT-01 | Claimed quotation differs by one character | `QUOTATION_MISMATCH` |
| TXT-02 | Claimed quotation is off by one at either boundary | `QUOTATION_MISMATCH` |
| TXT-03 | Leading or trailing spaces are omitted or added | `QUOTATION_MISMATCH` |
| TXT-04 | LF is substituted for preserved CRLF | `QUOTATION_MISMATCH` |
| TXT-05 | Hebrew quotation and range match exactly | Accepted |
| TXT-06 | Tree emoji in `A🌳B` is addressed by its complete UTF-8 span `[1, 5)` | Emoji accepted; any split boundary rejected |
| TXT-07 | Combining `e + accent` is changed to precomposed `é` | `QUOTATION_MISMATCH` |
| TXT-08 | Same letters with different case | `QUOTATION_MISMATCH` |
| TXT-09 | Correct quotation paired with another valid range | `QUOTATION_MISMATCH` |
| TXT-10 | Duplicate quotation text appears twice | Only the supplied exact occurrence/range is verified |
| REV-01 | Source changes after claim creation but before verification | Stale version or integrity failure; never accepted |
| REV-02 | Resolver fails or times out | Closed failure; never accepted |
| REV-03 | Verifier is rerun against the same immutable snapshot | Identical deterministic result and evidence |

## Property and mutation tests

After the example cases pass, add generated checks:

- For every canonical fixture and every valid non-empty UTF-8-boundary-aligned `[start, end)`, the exact extracted slice is accepted.
- Changing any one of `sourceId`, version, hash, start, end, offset unit, or quotation causes rejection unless the changed tuple independently describes a valid claim.
- Any insertion, deletion, or replacement in an accepted quotation causes rejection.
- Random Unicode fixtures round-trip by UTF-8 byte offsets, including non-BMP and combining characters.
- Newline bytes and Unicode normalization forms remain unchanged through ingestion, resolution, extraction, and evidence serialization.

Use a fixed seed and retain the smallest failing example so failures are reproducible.

## Integration and caller tests

Once the real architecture is known, add coverage that:

- The production resolver cannot return two snapshots for one identity/version.
- Stored canonical content reproduces its recorded hash.
- Persisted claims survive serialization without offset, newline, or Unicode changes.
- All callers reject unverified, failed, or unavailable results.
- Illegal state transitions and proposer/implementer self-approval are rejected.
- Verified records are immutable; corrections create a superseding record.
- Verification evidence is sufficient for the independent reviewer to reproduce the outcome.
- Existing Ariel behavior remains byte-for-byte and test-for-test unchanged unless separately authorized.

## Automation gates

The prototype contract suite currently runs with `node --test`. Add the remaining conformance cases before integrating it into a product repository's existing test command and CI. Gate integration in this order: contract tests, source-store integration tests, existing tests, lint, typecheck, build, then independent review. Never create a second product test stack merely to execute this plan.
