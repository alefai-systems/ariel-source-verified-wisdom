'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { ImmutableSourceRegistry } = require('../../source-verification/src');
const { SOURCES } = require('../../source-verification/test/fixtures');
const {
  DEMO_MANIFEST,
  DEMO_REGISTRY,
  DEMO_SOURCE,
  PINNED_CONTENT_HASH,
  inspectManifest,
  reconstructSupport,
} = require('../src/demo-manifest');

test('demo imports the exact existing synthetic Hebrew/Unicode fixture', () => {
  assert.strictEqual(DEMO_SOURCE, SOURCES.hebrew);
  assert.equal(DEMO_SOURCE.canonicalText, 'מקור א: ״עֵץ 42?״ (בדיקה) \u200fRTL');
  assert.equal(DEMO_REGISTRY.getBySourceId(DEMO_SOURCE.sourceId).contentHash, PINNED_CONTENT_HASH);
});

test('bounded manifest ranges preflight against the pinned immutable source', () => {
  const inspection = inspectManifest();

  assert.equal(inspection.ok, true);
  assert.equal(inspection.modelEntries.length, 3);
  assert.deepEqual(
    inspection.modelEntries.map((entry) => entry.reference_id),
    ['fixture-quoted-segment', 'fixture-rtl-suffix', 'fixture-full-source'],
  );
  assert.equal(inspection.modelEntries[0].excerpt, 'עֵץ 42?');
  assert.deepEqual(inspection.modelEntries[0].range, {
    start: 15,
    end: 25,
    offset_unit: 'utf8-byte',
  });
});

test('support quotation is reconstructed from registry bytes', () => {
  const support = reconstructSupport(DEMO_MANIFEST[0]);

  assert.equal(support.quotation, 'עֵץ 42?');
  assert.equal(support.contentHash, PINNED_CONTENT_HASH);
  assert.equal(Object.isFrozen(support), true);
});

test('an altered registry source fails the pinned manifest integrity gate', () => {
  const alteredRegistry = new ImmutableSourceRegistry([{
    ...DEMO_SOURCE,
    canonicalText: `${DEMO_SOURCE.canonicalText}!`,
  }]);
  const inspection = inspectManifest(DEMO_MANIFEST, alteredRegistry);

  assert.equal(inspection.ok, false);
  assert.equal(inspection.verification.error.code, 'SOURCE_INTEGRITY_MISMATCH');
});
