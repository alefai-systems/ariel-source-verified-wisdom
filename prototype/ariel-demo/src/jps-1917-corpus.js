'use strict';

const { Buffer } = require('node:buffer');
const { sha256Utf8 } = require('../../source-verification/src');
const snapshot = require('../data/jps-1917-snapshot.json');
const { canonicalizeSefariaText } = require('./source-canonicalization');

const VERSION_TITLE = 'The Holy Scriptures: A New Translation (JPS 1917)';
const VERSION_SELECTOR = `english|${VERSION_TITLE}`;
const LANGUAGE = 'en';
const LICENSE = 'Public Domain';
const LICENSE_NOTE = 'This 1917 translation by the Jewish Publication Society is in the public domain. JPS graciously shared digital images of this text with the Open Siddur Project, from which the text was imported by Sefaria.';
const PROVIDER = 'Sefaria';
const RETRIEVED_AT = '2026-07-21T04:51:44.8906045+03:00';
const ATTRIBUTION = 'Text: The Holy Scriptures: A New Translation (JPS 1917), Public Domain. Digital text via Sefaria.';
const SOURCE_PINS = Object.freeze({
  'jps-1917-psalms-85-10-14': Object.freeze({
    reference: 'Psalms 85:10-14',
    pathname: '/api/v3/texts/Psalms.85.10-14',
    sha256: '0391d2350d08cac6bb8e535451f59f4606e132782c94b41799ca83e8da54a312',
    segmentReferences: Object.freeze([
      'Psalms 85:10',
      'Psalms 85:11',
      'Psalms 85:12',
      'Psalms 85:13',
      'Psalms 85:14',
    ]),
  }),
  'jps-1917-proverbs-12-19': Object.freeze({
    reference: 'Proverbs 12:19',
    pathname: '/api/v3/texts/Proverbs.12.19',
    sha256: '1c577e59924bcad0b8b2b06016abc12d9e9ff3b841c463a1698ea551bdf70ed4',
    segmentReferences: Object.freeze(['Proverbs 12:19']),
  }),
});
const NORMALIZATION = Object.freeze({
  id: 'ariel-sefaria-text-v1',
  steps: Object.freeze([
    'Decode HTML entities.',
    'Replace br elements and line breaks with one space.',
    'Remove remaining HTML tags.',
    'Normalize Unicode to NFC.',
    'Trim leading and trailing whitespace.',
    'Collapse internal whitespace to one space.',
    'Preserve capitalization and punctuation exactly.',
    'Encode the final canonical text as UTF-8.',
    'Calculate SHA-256 over the final stored UTF-8 bytes.',
  ]),
  segmentJoin: 'Canonical segments remain in API order and are joined with one ASCII space (U+0020).',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function invalidCorpus(reason) {
  throw new TypeError(`Pinned JPS 1917 corpus is invalid: ${reason}.`);
}

function isPinnedSourceUrl(value, expectedPathname) {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'www.sefaria.org' &&
      url.port === '' &&
      url.pathname === expectedPathname &&
      url.searchParams.size === 3 &&
      url.searchParams.get('version') === VERSION_SELECTOR &&
      url.searchParams.get('return_format') === 'text_only' &&
      url.searchParams.get('fill_in_missing_segments') === '0'
    );
  } catch {
    return false;
  }
}

function deriveSegmentRanges(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    invalidCorpus('segments must be a non-empty array');
  }

  let nextStart = 0;
  const seenReferences = new Set();
  return Object.freeze(segments.map((segment, index) => {
    if (!segment || typeof segment !== 'object') {
      invalidCorpus('each segment must be an object');
    }
    if (
      typeof segment.reference !== 'string' ||
      segment.reference.trim().length === 0 ||
      seenReferences.has(segment.reference)
    ) {
      invalidCorpus('segment references must be unique non-empty strings');
    }
    seenReferences.add(segment.reference);

    const canonicalText = canonicalizeSefariaText(segment.text);
    if (canonicalText.length === 0) {
      invalidCorpus('canonical segments must not be empty');
    }

    const start = nextStart;
    const end = start + Buffer.byteLength(canonicalText, 'utf8');
    nextStart = end + (index < segments.length - 1 ? 1 : 0);

    return deepFreeze({
      reference: segment.reference,
      altReference: typeof segment.altReference === 'string' ? segment.altReference : null,
      canonicalText,
      start,
      end,
      offsetUnit: 'utf8-byte',
    });
  }));
}

function buildPinnedSource(rawSource, shared) {
  if (!rawSource || typeof rawSource !== 'object') {
    invalidCorpus('source records must be objects');
  }
  const pin = rawSource && SOURCE_PINS[rawSource.sourceId];
  if (
    !pin ||
    typeof rawSource.sourceId !== 'string' || rawSource.sourceId.trim().length === 0 ||
    rawSource.reference !== pin.reference ||
    !isPinnedSourceUrl(rawSource.sourceUrl, pin.pathname) ||
    rawSource.responseReference !== rawSource.reference ||
    !Array.isArray(rawSource.warnings) || rawSource.warnings.length !== 0 ||
    rawSource.expectedSha256 !== pin.sha256
  ) {
    invalidCorpus('source identity, endpoint, response reference, warnings, or hash did not match the pin');
  }

  const segments = deriveSegmentRanges(rawSource.segments);
  if (
    segments.length !== pin.segmentReferences.length ||
    segments.some((segment, index) => segment.reference !== pin.segmentReferences[index])
  ) {
    invalidCorpus(`segment references changed for ${rawSource.sourceId}`);
  }
  const canonicalText = segments.map((segment) => segment.canonicalText).join(' ');
  const sha256 = sha256Utf8(canonicalText);
  if (sha256 !== rawSource.expectedSha256) {
    invalidCorpus(`SHA-256 mismatch for ${rawSource.sourceId}`);
  }

  return deepFreeze({
    sourceId: rawSource.sourceId,
    sourceVersion: `sha256:${sha256}`,
    canonicalText,
    reference: rawSource.reference,
    altReference: null,
    versionTitle: shared.versionTitle,
    language: shared.language,
    license: shared.license,
    licenseNote: shared.licenseNote,
    provider: shared.provider,
    sourceUrl: rawSource.sourceUrl,
    retrievedAt: shared.retrievedAt,
    normalization: NORMALIZATION,
    sha256,
    attribution: shared.attribution,
    segments,
  });
}

function buildPinnedCorpus(rawSnapshot = snapshot) {
  if (!rawSnapshot || typeof rawSnapshot !== 'object') {
    invalidCorpus('snapshot must be an object');
  }
  if (
    rawSnapshot.snapshotVersion !== 1 ||
    rawSnapshot.versionSelector !== VERSION_SELECTOR ||
    rawSnapshot.versionTitle !== VERSION_TITLE ||
    rawSnapshot.language !== LANGUAGE ||
    rawSnapshot.license !== LICENSE ||
    rawSnapshot.licenseNote !== LICENSE_NOTE ||
    rawSnapshot.provider !== PROVIDER ||
    rawSnapshot.retrievedAt !== RETRIEVED_AT ||
    rawSnapshot.attribution !== ATTRIBUTION ||
    !Array.isArray(rawSnapshot.sources) || rawSnapshot.sources.length !== 2
  ) {
    invalidCorpus('version, language, license, provider, timestamp, or source count did not match the pin');
  }

  const shared = {
    versionTitle: rawSnapshot.versionTitle,
    language: rawSnapshot.language,
    license: rawSnapshot.license,
    licenseNote: rawSnapshot.licenseNote,
    provider: rawSnapshot.provider,
    retrievedAt: rawSnapshot.retrievedAt,
    attribution: rawSnapshot.attribution,
  };
  const sources = rawSnapshot.sources.map((source) => buildPinnedSource(source, shared));
  if (new Set(sources.map((source) => source.sourceId)).size !== sources.length) {
    invalidCorpus('source identifiers must be unique');
  }
  return Object.freeze(sources);
}

const PINNED_JPS_1917_SOURCES = buildPinnedCorpus();

function findPinnedSource(sourceId, sources = PINNED_JPS_1917_SOURCES) {
  return sources.find((source) => source.sourceId === sourceId);
}

function findPinnedSegment(source, reference) {
  return source && source.segments.find((segment) => segment.reference === reference);
}

module.exports = Object.freeze({
  ATTRIBUTION,
  LANGUAGE,
  LICENSE,
  LICENSE_NOTE,
  NORMALIZATION,
  PINNED_JPS_1917_SOURCES,
  PROVIDER,
  RETRIEVED_AT,
  SOURCE_PINS,
  VERSION_SELECTOR,
  VERSION_TITLE,
  buildPinnedCorpus,
  deriveSegmentRanges,
  findPinnedSegment,
  findPinnedSource,
  isPinnedSourceUrl,
});
