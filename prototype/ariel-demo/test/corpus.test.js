'use strict';

const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const test = require('node:test');
const { sha256Utf8 } = require('../../source-verification/src');
const rawSnapshot = require('../data/jps-1917-snapshot.json');
const {
  LICENSE,
  PINNED_JPS_1917_SOURCES,
  VERSION_SELECTOR,
  VERSION_TITLE,
  buildPinnedCorpus,
  deriveSegmentRanges,
  findPinnedSegment,
  findPinnedSource,
} = require('../src/jps-1917-corpus');
const { canonicalizeSefariaText } = require('../src/source-canonicalization');

function cloneSnapshot() {
  return JSON.parse(JSON.stringify(rawSnapshot));
}

test('snapshot pins the exact requested JPS 1917 version and excludes default English selection', () => {
  assert.equal(VERSION_TITLE, 'The Holy Scriptures: A New Translation (JPS 1917)');
  assert.equal(VERSION_SELECTOR, `english|${VERSION_TITLE}`);
  assert.equal(rawSnapshot.versionSelector, VERSION_SELECTOR);
  assert.equal(rawSnapshot.language, 'en');
  assert.equal(rawSnapshot.license, LICENSE);
  assert.equal(LICENSE, 'Public Domain');

  for (const source of PINNED_JPS_1917_SOURCES) {
    const url = new URL(source.sourceUrl);
    assert.equal(url.searchParams.get('version'), VERSION_SELECTOR);
    assert.equal(url.searchParams.get('return_format'), 'text_only');
    assert.equal(url.searchParams.get('fill_in_missing_segments'), '0');
    assert.equal(source.versionTitle, VERSION_TITLE);
    assert.equal(source.license, 'Public Domain');
  }
});

test('canonicalization is deterministic and follows entity, break, tag, NFC, trim, and whitespace order', () => {
  const input = '  <i>Cafe\u0301&nbsp;&amp;</i><BR />first\r\nsecond\t  ';
  const expected = 'Café & first second';

  assert.equal(canonicalizeSefariaText(input), expected);
  assert.equal(canonicalizeSefariaText(input), canonicalizeSefariaText(input));
  assert.equal(canonicalizeSefariaText(input).normalize('NFC'), expected);
  assert.throws(() => canonicalizeSefariaText('unsafe &copy; entity'), /unsupported HTML entity/u);
});

test('segment ranges are derived from UTF-8 byte lengths with one ASCII joining space', () => {
  const ranges = deriveSegmentRanges([
    { reference: 'Example 1', text: 'א' },
    { reference: 'Example 2', text: 'é' },
  ]);

  assert.deepEqual(ranges.map(({ reference, start, end }) => ({ reference, start, end })), [
    { reference: 'Example 1', start: 0, end: 2 },
    { reference: 'Example 2', start: 3, end: 5 },
  ]);
});

test('Psalms 85:10-14 is one pinned source with programmatically derived verse ranges', () => {
  const source = findPinnedSource('jps-1917-psalms-85-10-14');
  const psalm = findPinnedSegment(source, 'Psalms 85:12');

  assert.equal(Buffer.byteLength(source.canonicalText, 'utf8'), 399);
  assert.equal(source.sha256, '0391d2350d08cac6bb8e535451f59f4606e132782c94b41799ca83e8da54a312');
  assert.equal(sha256Utf8(source.canonicalText), source.sha256);
  assert.equal(source.sourceVersion, `sha256:${source.sha256}`);
  assert.deepEqual(
    source.segments.map(({ reference, start, end }) => ({ reference, start, end })),
    [
      { reference: 'Psalms 85:10', start: 0, end: 82 },
      { reference: 'Psalms 85:11', start: 83, end: 164 },
      { reference: 'Psalms 85:12', start: 165, end: 246 },
      { reference: 'Psalms 85:13', start: 247, end: 328 },
      { reference: 'Psalms 85:14', start: 329, end: 399 },
    ],
  );
  assert.equal(psalm.altReference, 'Psalm 85:11 (common Christian/KJV numbering)');
  assert.equal(
    psalm.canonicalText,
    'Truth springeth out of the earth; And righteousness hath looked down from heaven.',
  );
});

test('Proverbs 12:19 is the second pinned public-domain source', () => {
  const source = findPinnedSource('jps-1917-proverbs-12-19');
  const segment = findPinnedSegment(source, 'Proverbs 12:19');

  assert.equal(Buffer.byteLength(source.canonicalText, 'utf8'), 87);
  assert.equal(source.sha256, '1c577e59924bcad0b8b2b06016abc12d9e9ff3b841c463a1698ea551bdf70ed4');
  assert.equal(sha256Utf8(source.canonicalText), source.sha256);
  assert.deepEqual({ start: segment.start, end: segment.end }, { start: 0, end: 87 });
  assert.equal(
    segment.canonicalText,
    'The lip of truth shall be established for ever; But a lying tongue is but for a moment.',
  );
});

test('pinned metadata contains the required provenance and normalization fields', () => {
  for (const source of PINNED_JPS_1917_SOURCES) {
    assert.equal(source.provider, 'Sefaria');
    assert.equal(source.language, 'en');
    assert.equal(source.license, 'Public Domain');
    assert.match(source.licenseNote, /public domain/iu);
    assert.equal(source.retrievedAt, '2026-07-21T04:51:44.8906045+03:00');
    assert.equal(source.normalization.id, 'ariel-sefaria-text-v1');
    assert.equal(source.normalization.steps.length, 9);
    assert.match(source.attribution, /Digital text via Sefaria/u);
    assert.equal(source.sha256, sha256Utf8(source.canonicalText));
    assert.equal(Object.isFrozen(source), true);
  }
});

test('version, license, source, segment, and byte drift all fail closed', () => {
  const mutations = [
    (value) => { value.versionSelector = 'english'; },
    (value) => { value.versionTitle = 'Revised JPS 2023'; },
    (value) => { value.license = 'CC-BY-NC'; },
    (value) => { value.licenseNote = 'substituted note'; },
    (value) => { value.retrievedAt = '2026-07-22T00:00:00Z'; },
    (value) => { value.sources[0].responseReference = 'Psalms 85'; },
    (value) => { value.sources[0].segments.splice(2, 1); },
    (value) => { value.sources[0].segments[2].text += '!'; },
    (value) => { value.sources[1].sourceUrl = value.sources[0].sourceUrl; },
  ];

  for (const mutate of mutations) {
    const candidate = cloneSnapshot();
    mutate(candidate);
    assert.throws(() => buildPinnedCorpus(candidate), /Pinned JPS 1917 corpus is invalid/u);
  }
});
