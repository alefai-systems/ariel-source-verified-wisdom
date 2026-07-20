'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ImmutableSourceRegistry,
  verifySupportedClaim,
} = require('../src');
const { SOURCES } = require('./fixtures');

const registry = new ImmutableSourceRegistry([SOURCES.hebrew, SOURCES.ascii]);

function supportFor(name) {
  const source = SOURCES[name];
  const snapshot = registry.resolve(source.sourceId, source.sourceVersion);
  return {
    sourceId: source.sourceId,
    sourceVersion: source.sourceVersion,
    hashAlgorithm: snapshot.hashAlgorithm,
    contentHash: snapshot.contentHash,
    offsetUnit: 'utf8-byte',
    start: 0,
    end: snapshot.byteLength,
    quotation: source.canonicalText,
  };
}

test('claimId is required', () => {
  const result = verifySupportedClaim({ claimId: ' ', supports: [supportFor('ascii')] }, registry);
  assert.equal(result.error.code, 'INVALID_CLAIM_ID');
});

test('a claim with no declared support fails closed', () => {
  const result = verifySupportedClaim({ claimId: 'claim-1', supports: [] }, registry);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'UNSUPPORTED_CLAIM');
});

test('a claim with at least one valid declared support verifies', () => {
  const result = verifySupportedClaim({ claimId: 'claim-2', supports: [supportFor('hebrew')] }, registry);

  assert.equal(result.ok, true);
  assert.equal(result.claim.supportCount, 1);
  assert.equal(result.claim.supports[0].sourceId, SOURCES.hebrew.sourceId);
});

test('all declared supports must be valid', () => {
  const result = verifySupportedClaim({
    claimId: 'claim-3',
    supports: [supportFor('ascii'), { ...supportFor('hebrew'), quotation: 'tampered' }],
  }, registry);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'CLAIM_SUPPORT_INVALID');
  assert.deepEqual(result.error.details, {
    supportIndex: 1,
    causeCode: 'QUOTATION_MISMATCH',
  });
});

test('multiple valid declared supports are retained as reproducible evidence', () => {
  const result = verifySupportedClaim({
    claimId: 'claim-4',
    supports: [supportFor('ascii'), supportFor('hebrew')],
  }, registry);

  assert.equal(result.ok, true);
  assert.equal(result.claim.supportCount, 2);
  assert.equal(Object.isFrozen(result.claim.supports), true);
});
