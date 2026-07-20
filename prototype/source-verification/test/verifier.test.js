'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ImmutableSourceRegistry,
  verifyQuotation,
} = require('../src');
const { HEBREW_TEXT, SOURCES } = require('./fixtures');

const registry = new ImmutableSourceRegistry(Object.values(SOURCES));

function exactClaim(sourceName, start = 0, end, quotation) {
  const source = SOURCES[sourceName];
  const snapshot = registry.resolve(source.sourceId, source.sourceVersion);
  const finalEnd = end === undefined ? snapshot.byteLength : end;
  const finalQuotation = quotation === undefined
    ? Buffer.from(source.canonicalText, 'utf8').subarray(start, finalEnd).toString('utf8')
    : quotation;

  return {
    sourceId: source.sourceId,
    sourceVersion: source.sourceVersion,
    hashAlgorithm: snapshot.hashAlgorithm,
    contentHash: snapshot.contentHash,
    offsetUnit: 'utf8-byte',
    start,
    end: finalEnd,
    quotation: finalQuotation,
  };
}

test('full synthetic Hebrew RTL fixture verifies exactly', () => {
  const result = verifyQuotation(exactClaim('hebrew'), registry);

  assert.equal(result.ok, true);
  assert.equal(result.evidence.quotation, HEBREW_TEXT);
  assert.deepEqual(result.evidence.range, { start: 0, end: 47, offsetUnit: 'utf8-byte' });
  assert.equal(Object.isFrozen(result.evidence), true);
  assert.match(HEBREW_TEXT, /מקור א: ״עֵץ 42\?״ \(בדיקה\)/u);
});

test('Hebrew letters, niqqud, spaces, numbers, and question mark verify at exact [15, 25) boundaries', () => {
  const result = verifyQuotation(exactClaim('hebrew', 15, 25, 'עֵץ 42?'), registry);

  assert.equal(result.ok, true);
  assert.equal(result.evidence.extractedText, 'עֵץ 42?');
});

test('exact suffix ending at source byte length verifies', () => {
  const result = verifyQuotation(exactClaim('hebrew', 44, 47, 'RTL'), registry);
  assert.equal(result.ok, true);
});

test('unknown sourceId fails closed', () => {
  const result = verifyQuotation({ ...exactClaim('ascii'), sourceId: 'missing' }, registry);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'UNKNOWN_SOURCE');
});

test('well-formed but different sourceVersion is stale', () => {
  const result = verifyQuotation({ ...exactClaim('ascii'), sourceVersion: 'v2' }, registry);
  assert.equal(result.error.code, 'STALE_SOURCE_VERSION');
});

test('sourceId and sourceVersion comparisons are case-sensitive', () => {
  assert.equal(
    verifyQuotation({ ...exactClaim('ascii'), sourceId: 'ASCII' }, registry).error.code,
    'UNKNOWN_SOURCE',
  );
  assert.equal(
    verifyQuotation({ ...exactClaim('ascii'), sourceVersion: 'V0' }, registry).error.code,
    'STALE_SOURCE_VERSION',
  );
});

test('invalid sourceId shapes are rejected before lookup', () => {
  for (const sourceId of [undefined, null, 0, '', '  ']) {
    assert.equal(
      verifyQuotation({ ...exactClaim('ascii'), sourceId }, registry).error.code,
      'INVALID_SOURCE_ID',
    );
  }
});

test('invalid sourceVersion shapes are rejected before lookup', () => {
  for (const sourceVersion of [undefined, null, 0, '', '  ']) {
    assert.equal(
      verifyQuotation({ ...exactClaim('ascii'), sourceVersion }, registry).error.code,
      'INVALID_SOURCE_VERSION',
    );
  }
});

test('missing or unsupported hashAlgorithm is rejected', () => {
  assert.equal(
    verifyQuotation({ ...exactClaim('ascii'), hashAlgorithm: undefined }, registry).error.code,
    'INVALID_HASH_ALGORITHM',
  );
  assert.equal(
    verifyQuotation({ ...exactClaim('ascii'), hashAlgorithm: 'sha512' }, registry).error.code,
    'INVALID_HASH_ALGORITHM',
  );
});

test('malformed SHA-256 contentHash is rejected', () => {
  for (const contentHash of [undefined, '', 'abc', 'z'.repeat(64)]) {
    assert.equal(
      verifyQuotation({ ...exactClaim('ascii'), contentHash }, registry).error.code,
      'INVALID_CONTENT_HASH',
    );
  }
});

test('a valid but incorrect SHA-256 digest fails integrity verification', () => {
  const result = verifyQuotation({ ...exactClaim('ascii'), contentHash: '0'.repeat(64) }, registry);
  assert.equal(result.error.code, 'SOURCE_INTEGRITY_MISMATCH');
});

test('uppercase hexadecimal SHA-256 is accepted and normalized in evidence', () => {
  const claim = exactClaim('ascii');
  const result = verifyQuotation({ ...claim, contentHash: claim.contentHash.toUpperCase() }, registry);

  assert.equal(result.ok, true);
  assert.equal(result.evidence.contentHash, claim.contentHash);
});

test('caller-bound expected identity rejects another internally valid identity', () => {
  const result = verifyQuotation({
    ...exactClaim('ascii'),
    expectedIdentity: { sourceId: 'other', sourceVersion: '0' },
  }, registry);
  assert.equal(result.error.code, 'SOURCE_IDENTITY_MISMATCH');
});

test('a resolver returning the wrong source identity fails closed before acceptance', () => {
  const wrongSourceResolver = {
    getBySourceId() {
      return registry.resolve(SOURCES.hebrew.sourceId, SOURCES.hebrew.sourceVersion);
    },
  };
  const result = verifyQuotation({
    ...exactClaim('ascii'),
    expectedIdentity: { sourceId: SOURCES.ascii.sourceId, sourceVersion: SOURCES.ascii.sourceVersion },
  }, wrongSourceResolver);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'SOURCE_IDENTITY_MISMATCH');
  assert.deepEqual(result.error.details, {
    requestedSourceId: SOURCES.ascii.sourceId,
    resolvedSourceId: SOURCES.hebrew.sourceId,
  });
});

test('missing and throwing resolver interfaces return stable non-leaking SOURCE_UNAVAILABLE results', () => {
  const claim = exactClaim('ascii');
  const missing = verifyQuotation(claim, {});
  const throwingResolver = {
    getBySourceId() {
      throw new Error('private resolver failure detail');
    },
  };
  const first = verifyQuotation(claim, throwingResolver);
  const second = verifyQuotation(claim, throwingResolver);

  assert.equal(missing.error.code, 'SOURCE_UNAVAILABLE');
  assert.deepEqual(missing.error.details, { reason: 'RESOLVER_INTERFACE_MISSING' });
  assert.deepEqual(first, second);
  assert.equal(first.error.code, 'SOURCE_UNAVAILABLE');
  assert.deepEqual(first.error.details, { reason: 'RESOLUTION_FAILED' });
  assert.equal(JSON.stringify(first).includes('private resolver failure detail'), false);
});

test('a malformed resolved snapshot returns deterministic SOURCE_UNAVAILABLE', () => {
  const malformedResolver = {
    getBySourceId() {
      return {
        sourceId: SOURCES.ascii.sourceId,
        sourceVersion: SOURCES.ascii.sourceVersion,
        canonicalText: SOURCES.ascii.canonicalText,
        hashAlgorithm: 'sha256',
        contentHash: 'not-a-digest',
      };
    },
  };
  const first = verifyQuotation(exactClaim('ascii'), malformedResolver);
  const second = verifyQuotation(exactClaim('ascii'), malformedResolver);

  assert.deepEqual(first, second);
  assert.equal(first.error.code, 'SOURCE_UNAVAILABLE');
  assert.deepEqual(first.error.details, { reason: 'MALFORMED_SNAPSHOT' });
});

test('verification derives UTF-8 byte length instead of trusting snapshot byteLength', () => {
  const snapshot = registry.resolve(SOURCES.ascii.sourceId, SOURCES.ascii.sourceVersion);
  const inconsistentLengthResolver = {
    getBySourceId() {
      return { ...snapshot, byteLength: 1 };
    },
  };
  const result = verifyQuotation(exactClaim('ascii'), inconsistentLengthResolver);

  assert.equal(result.ok, true);
  assert.equal(result.evidence.sourceByteLength, 21);
});

test('missing or unsupported offset unit explicitly rejects the range', () => {
  assert.equal(
    verifyQuotation({ ...exactClaim('ascii'), offsetUnit: undefined }, registry).error.code,
    'INVALID_RANGE',
  );
  assert.equal(
    verifyQuotation({ ...exactClaim('ascii'), offsetUnit: 'utf16-code-unit' }, registry).error.code,
    'INVALID_RANGE',
  );
});

test('missing, fractional, NaN, infinite, and non-safe offsets explicitly reject', () => {
  const invalidPairs = [
    [undefined, 1],
    [0.5, 1],
    [0, Number.NaN],
    [0, Number.POSITIVE_INFINITY],
    [0, Number.MAX_SAFE_INTEGER + 1],
  ];

  for (const [start, end] of invalidPairs) {
    assert.equal(
      verifyQuotation({ ...exactClaim('ascii'), start, end }, registry).error.code,
      'INVALID_RANGE',
    );
  }
});

test('negative offsets explicitly reject', () => {
  assert.equal(
    verifyQuotation({ ...exactClaim('ascii'), start: -1 }, registry).error.code,
    'INVALID_RANGE',
  );
});

test('empty ranges explicitly reject', () => {
  assert.equal(
    verifyQuotation({ ...exactClaim('ascii'), start: 3, end: 3 }, registry).error.code,
    'INVALID_RANGE',
  );
});

test('reversed ranges explicitly reject', () => {
  assert.equal(
    verifyQuotation({ ...exactClaim('ascii'), start: 4, end: 3 }, registry).error.code,
    'INVALID_RANGE',
  );
});

test('out-of-bounds ranges explicitly reject', () => {
  const claim = exactClaim('ascii');
  assert.equal(
    verifyQuotation({ ...claim, end: claim.end + 1 }, registry).error.code,
    'RANGE_OUT_OF_BOUNDS',
  );
});

test('a start offset splitting a Hebrew UTF-8 sequence explicitly rejects', () => {
  const result = verifyQuotation(exactClaim('hebrew', 16, 25, 'invalid'), registry);
  assert.equal(result.error.code, 'RANGE_NOT_UTF8_BOUNDARY');
});

test('an end offset splitting a niqqud combining mark explicitly rejects', () => {
  const result = verifyQuotation(exactClaim('hebrew', 15, 18, 'invalid'), registry);
  assert.equal(result.error.code, 'RANGE_NOT_UTF8_BOUNDARY');
});

test('tampering one character in an otherwise valid quotation rejects', () => {
  const result = verifyQuotation(exactClaim('hebrew', 15, 25, 'עֵץ 43?'), registry);
  assert.equal(result.error.code, 'QUOTATION_MISMATCH');
});

test('deleting one character from an otherwise exact quotation rejects', () => {
  const result = verifyQuotation(exactClaim('ascii', 0, 6, 'Tree '), registry);
  assert.equal(result.error.code, 'QUOTATION_MISMATCH');
});

test('adding one character to an otherwise exact quotation rejects', () => {
  const result = verifyQuotation(exactClaim('ascii', 0, 6, 'Tree A!'), registry);
  assert.equal(result.error.code, 'QUOTATION_MISMATCH');
});

test('leading and trailing spaces are preserved and trimming rejects', () => {
  assert.equal(verifyQuotation(exactClaim('whitespace'), registry).ok, true);
  assert.equal(
    verifyQuotation(exactClaim('whitespace', 0, 14, 'exact text'), registry).error.code,
    'QUOTATION_MISMATCH',
  );
});

test('CRLF is preserved exactly and LF substitution rejects', () => {
  assert.equal(verifyQuotation(exactClaim('crlf'), registry).ok, true);
  assert.equal(
    verifyQuotation(exactClaim('crlf', 0, 13, 'first\nsecond'), registry).error.code,
    'QUOTATION_MISMATCH',
  );
});

test('combining and precomposed Unicode forms are not normalized', () => {
  assert.equal(verifyQuotation(exactClaim('combining'), registry).ok, true);
  assert.equal(
    verifyQuotation(exactClaim('combining', 0, 6, 'Café'), registry).error.code,
    'QUOTATION_MISMATCH',
  );
});

test('quotation matching remains case-sensitive', () => {
  assert.equal(
    verifyQuotation(exactClaim('ascii', 0, 4, 'tree'), registry).error.code,
    'QUOTATION_MISMATCH',
  );
});

test('structured failures are deterministic and omit unrelated claim data', () => {
  const claim = {
    ...exactClaim('hebrew', 15, 25, 'tampered'),
    unrelatedSecret: 'must-not-appear',
  };
  const first = verifyQuotation(claim, registry);
  const second = verifyQuotation(claim, registry);
  const serialized = JSON.stringify(first);

  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first), ['ok', 'verifierVersion', 'error']);
  assert.deepEqual(Object.keys(first.error), ['code', 'message', 'details']);
  assert.equal(serialized.includes('must-not-appear'), false);
  assert.equal(serialized.includes(HEBREW_TEXT), false);
});

test('repeated successful resolution produces identical deterministic evidence', () => {
  const claim = exactClaim('hebrew', 15, 25, 'עֵץ 42?');
  const first = verifyQuotation(claim, registry);
  const second = verifyQuotation(claim, registry);

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
});
