'use strict';

const {
  ImmutableSourceRegistry,
  verifyQuotation,
  verifySupportedClaim,
} = require('../src');

const hebrewSource = Object.freeze({
  sourceId: 'demo-hebrew-rtl',
  sourceVersion: 'v1',
  canonicalText: 'מקור א: ״עֵץ 42?״ (בדיקה) \u200fRTL',
});

let registry = new ImmutableSourceRegistry();
registry = registry.withSource(hebrewSource);

const snapshot = registry.resolve(hebrewSource.sourceId, hebrewSource.sourceVersion);
console.log(`[registration] sourceId=${snapshot.sourceId} sourceVersion=${snapshot.sourceVersion} bytes=${snapshot.byteLength}`);
console.log(`[retrieval] exact=${snapshot.canonicalText === hebrewSource.canonicalText} text=${snapshot.canonicalText}`);

const validSupport = {
  sourceId: snapshot.sourceId,
  sourceVersion: snapshot.sourceVersion,
  hashAlgorithm: snapshot.hashAlgorithm,
  contentHash: snapshot.contentHash,
  offsetUnit: 'utf8-byte',
  start: 15,
  end: 25,
  quotation: 'עֵץ 42?',
};

const integrity = verifyQuotation(validSupport, registry);
console.log(`[integrity] ${integrity.ok ? 'PASS' : 'FAIL'} sha256=${snapshot.contentHash}`);

const demonstrations = [
  ['tampered-quote', verifyQuotation({ ...validSupport, quotation: 'עֵץ 43?' }, registry), 'QUOTATION_MISMATCH'],
  ['unknown-id', verifyQuotation({ ...validSupport, sourceId: 'not-registered' }, registry), 'UNKNOWN_SOURCE'],
  ['unsupported-claim', verifySupportedClaim({ claimId: 'demo-claim', supports: [] }, registry), 'UNSUPPORTED_CLAIM'],
];

let demoPassed = integrity.ok;
for (const [label, result, expectedCode] of demonstrations) {
  const passed = !result.ok && result.error.code === expectedCode;
  demoPassed &&= passed;
  console.log(`[rejection:${label}] ${passed ? 'PASS' : 'FAIL'} code=${result.error && result.error.code}`);
}

if (!demoPassed) {
  process.exitCode = 1;
}
