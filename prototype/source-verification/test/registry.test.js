'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const {
  ImmutableSourceRegistry,
  SourceVerificationError,
} = require('../src');
const { HEBREW_TEXT, SOURCES } = require('./fixtures');

test('registry creates a frozen immutable snapshot with SHA-256 metadata', () => {
  const registry = new ImmutableSourceRegistry([SOURCES.hebrew]);
  const snapshot = registry.resolve('synthetic-hebrew-rtl', 'v1');
  const independentlyComputedHash = createHash('sha256')
    .update(Buffer.from(HEBREW_TEXT, 'utf8'))
    .digest('hex');

  assert.equal(Object.isFrozen(registry), true);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(snapshot.hashAlgorithm, 'sha256');
  assert.equal(snapshot.contentHash, independentlyComputedHash);
  assert.equal(snapshot.byteLength, 47);
});

test('registry preserves exact canonical text, combining marks, and CRLF', () => {
  const registry = new ImmutableSourceRegistry([SOURCES.hebrew, SOURCES.crlf]);

  assert.equal(registry.resolve('synthetic-hebrew-rtl', 'v1').canonicalText, HEBREW_TEXT);
  assert.equal(registry.resolve('crlf', 'v1').canonicalText, 'first\r\nsecond');
  assert.equal(HEBREW_TEXT.includes('עֵץ'), true);
  assert.equal(HEBREW_TEXT.includes('\u200f'), true);
});

test('duplicate registration of the exact immutable source is idempotent', () => {
  const registry = new ImmutableSourceRegistry([SOURCES.hebrew, { ...SOURCES.hebrew }]);
  assert.equal(registry.size, 1);
  assert.strictEqual(registry.withSource({ ...SOURCES.hebrew }), registry);
});

test('the same sourceId with different text is rejected', () => {
  assert.throws(
    () => new ImmutableSourceRegistry([SOURCES.hebrew, { ...SOURCES.hebrew, canonicalText: 'changed' }]),
    (error) => error instanceof SourceVerificationError && error.code === 'SOURCE_ID_CONFLICT',
  );
});

test('the same sourceId with a different version is rejected', () => {
  assert.throws(
    () => new ImmutableSourceRegistry([SOURCES.hebrew, { ...SOURCES.hebrew, sourceVersion: 'v2' }]),
    (error) => error instanceof SourceVerificationError && error.code === 'SOURCE_VERSION_CONFLICT',
  );
});

test('missing, non-string, empty, and whitespace-only sourceId values are rejected', () => {
  for (const sourceId of [undefined, null, 7, '', '   ']) {
    assert.throws(
      () => new ImmutableSourceRegistry([{ ...SOURCES.ascii, sourceId }]),
      (error) => error.code === 'INVALID_SOURCE_ID',
    );
  }
});

test('missing, non-string, empty, and whitespace-only sourceVersion values are rejected', () => {
  for (const sourceVersion of [undefined, null, 7, '', '   ']) {
    assert.throws(
      () => new ImmutableSourceRegistry([{ ...SOURCES.ascii, sourceVersion }]),
      (error) => error.code === 'INVALID_SOURCE_VERSION',
    );
  }
});

test('non-string and ill-formed Unicode canonical text are rejected', () => {
  for (const canonicalText of [undefined, 7, '\ud800']) {
    assert.throws(
      () => new ImmutableSourceRegistry([{ ...SOURCES.ascii, canonicalText }]),
      (error) => error.code === 'INVALID_CANONICAL_TEXT',
    );
  }
});

test('withSource returns a new registry without mutating the original', () => {
  const original = new ImmutableSourceRegistry([SOURCES.ascii]);
  const extended = original.withSource(SOURCES.hebrew);

  assert.equal(original.size, 1);
  assert.equal(original.getBySourceId(SOURCES.hebrew.sourceId), undefined);
  assert.equal(extended.size, 2);
  assert.equal(extended.resolve(SOURCES.hebrew.sourceId, SOURCES.hebrew.sourceVersion).canonicalText, HEBREW_TEXT);
});

test('source identity and version resolution are case-sensitive and accept the string 0', () => {
  const registry = new ImmutableSourceRegistry([SOURCES.ascii]);

  assert.ok(registry.resolve('ascii', '0'));
  assert.equal(registry.resolve('ASCII', '0'), undefined);
  assert.equal(registry.resolve('ascii', 'V0'), undefined);
});

test('different sourceIds may independently bind identical immutable bytes', () => {
  const duplicateBytes = { ...SOURCES.ascii, sourceId: 'ascii-copy' };
  const registry = new ImmutableSourceRegistry([SOURCES.ascii, duplicateBytes]);

  assert.equal(registry.size, 2);
  assert.equal(
    registry.resolve('ascii', '0').contentHash,
    registry.resolve('ascii-copy', '0').contentHash,
  );
});
