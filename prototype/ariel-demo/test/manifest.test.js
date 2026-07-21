'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { ImmutableSourceRegistry } = require('../../source-verification/src');
const {
  DEMO_MANIFEST,
  DEMO_REGISTRY,
  PINNED_JPS_1917_SOURCES,
  PROVERBS_SOURCE,
  PSALMS_SOURCE,
  inspectManifest,
  reconstructSupport,
} = require('../src/demo-manifest');

test('demo registry contains only the two exact pinned JPS 1917 sources', () => {
  assert.equal(DEMO_REGISTRY.size, 2);
  assert.equal(PINNED_JPS_1917_SOURCES.length, 2);
  assert.equal(
    DEMO_REGISTRY.getBySourceId(PSALMS_SOURCE.sourceId).contentHash,
    '0391d2350d08cac6bb8e535451f59f4606e132782c94b41799ca83e8da54a312',
  );
  assert.equal(
    DEMO_REGISTRY.getBySourceId(PROVERBS_SOURCE.sourceId).contentHash,
    '1c577e59924bcad0b8b2b06016abc12d9e9ff3b841c463a1698ea551bdf70ed4',
  );
});

test('bounded manifest preflights both sources and exposes only opaque model tokens plus excerpts', () => {
  const inspection = inspectManifest();

  assert.equal(inspection.ok, true);
  assert.equal(inspection.modelEntries.length, 2);
  assert.deepEqual(
    inspection.modelEntries.map((entry) => entry.reference_id),
    ['jps-source-a', 'jps-source-b'],
  );
  for (const entry of inspection.modelEntries) {
    assert.deepEqual(Object.keys(entry).sort(), ['description', 'excerpt', 'label', 'reference_id']);
    assert.equal(Object.hasOwn(entry, 'source_id'), false);
    assert.equal(Object.hasOwn(entry, 'source_version'), false);
    assert.equal(Object.hasOwn(entry, 'range'), false);
    assert.equal(Object.hasOwn(entry, 'content_hash'), false);
  }
  assert.equal(
    inspection.modelEntries[0].excerpt,
    'Truth springeth out of the earth; And righteousness hath looked down from heaven.',
  );
});

test('Psalm 85:12 support is reconstructed from the registered multi-segment source bytes', () => {
  const support = reconstructSupport(DEMO_MANIFEST[0]);

  assert.equal(support.start, 165);
  assert.equal(support.end, 246);
  assert.equal(
    support.quotation,
    'Truth springeth out of the earth; And righteousness hath looked down from heaven.',
  );
  assert.equal(support.contentHash, PSALMS_SOURCE.sha256);
  assert.equal(Object.isFrozen(support), true);
});

test('Proverbs 12:19 is a valid second manifest option', () => {
  const support = reconstructSupport(DEMO_MANIFEST[1]);

  assert.deepEqual({ start: support.start, end: support.end }, { start: 0, end: 87 });
  assert.equal(
    support.quotation,
    'The lip of truth shall be established for ever; But a lying tongue is but for a moment.',
  );
});

test('manifest retains exact public provenance and alternate-numbering metadata', () => {
  const psalm = DEMO_MANIFEST[0];

  assert.equal(psalm.reference, 'Psalms 85:12');
  assert.equal(psalm.altReference, 'Psalm 85:11 (common Christian/KJV numbering)');
  assert.equal(psalm.versionTitle, 'The Holy Scriptures: A New Translation (JPS 1917)');
  assert.equal(psalm.language, 'en');
  assert.equal(psalm.license, 'Public Domain');
  assert.equal(psalm.provider, 'Sefaria');
  assert.equal(psalm.segmentReferences.length, 5);
  assert.equal(psalm.sha256, PSALMS_SOURCE.sha256);
});

test('an altered registry source fails the pinned manifest integrity gate', () => {
  const alteredRegistry = new ImmutableSourceRegistry(PINNED_JPS_1917_SOURCES.map((source) => (
    source.sourceId === PSALMS_SOURCE.sourceId
      ? { ...source, canonicalText: `${source.canonicalText}!` }
      : source
  )));
  const inspection = inspectManifest(DEMO_MANIFEST, alteredRegistry);

  assert.equal(inspection.ok, false);
  assert.equal(inspection.verification.error.code, 'SOURCE_INTEGRITY_MISMATCH');
});
