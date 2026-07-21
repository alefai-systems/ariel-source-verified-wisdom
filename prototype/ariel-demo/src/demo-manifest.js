'use strict';

const { Buffer } = require('node:buffer');
const {
  HASH_ALGORITHM,
  OFFSET_UNIT,
  ImmutableSourceRegistry,
  verifyQuotation,
} = require('../../source-verification/src');
const {
  PINNED_JPS_1917_SOURCES,
  findPinnedSegment,
  findPinnedSource,
} = require('./jps-1917-corpus');

const PSALMS_SOURCE_ID = 'jps-1917-psalms-85-10-14';
const PROVERBS_SOURCE_ID = 'jps-1917-proverbs-12-19';
const PSALMS_SOURCE = findPinnedSource(PSALMS_SOURCE_ID);
const PROVERBS_SOURCE = findPinnedSource(PROVERBS_SOURCE_ID);
const DEMO_REGISTRY = new ImmutableSourceRegistry(PINNED_JPS_1917_SOURCES);

function freezeSegmentMetadata(source) {
  return Object.freeze(source.segments.map((segment) => Object.freeze({
    reference: segment.reference,
    altReference: segment.altReference,
    start: segment.start,
    end: segment.end,
    offsetUnit: segment.offsetUnit,
  })));
}

function freezeReference({ referenceId, source, segmentReference, label, description }) {
  const segment = findPinnedSegment(source, segmentReference);
  if (!segment) {
    throw new TypeError(`Pinned segment is unavailable: ${segmentReference}.`);
  }

  return Object.freeze({
    referenceId,
    sourceId: source.sourceId,
    sourceVersion: source.sourceVersion,
    hashAlgorithm: HASH_ALGORITHM,
    contentHash: source.sha256,
    offsetUnit: OFFSET_UNIT,
    start: segment.start,
    end: segment.end,
    reference: segment.reference,
    altReference: segment.altReference,
    registeredSourceReference: source.reference,
    versionTitle: source.versionTitle,
    language: source.language,
    license: source.license,
    licenseNote: source.licenseNote,
    provider: source.provider,
    sourceUrl: source.sourceUrl,
    retrievedAt: source.retrievedAt,
    normalization: source.normalization,
    sha256: source.sha256,
    attribution: source.attribution,
    segmentReferences: freezeSegmentMetadata(source),
    label,
    description,
  });
}

const DEMO_MANIFEST = Object.freeze([
  freezeReference({
    referenceId: 'jps-source-a',
    source: PSALMS_SOURCE,
    segmentReference: 'Psalms 85:12',
    label: 'Truth and righteousness',
    description: 'A public-domain JPS 1917 passage about truth emerging from earth and righteousness looking down from heaven.',
  }),
  freezeReference({
    referenceId: 'jps-source-b',
    source: PROVERBS_SOURCE,
    segmentReference: 'Proverbs 12:19',
    label: 'Truthful speech',
    description: 'A public-domain JPS 1917 proverb contrasting enduring truth with a momentary lying tongue.',
  }),
]);

function sourceSnapshot(registry, sourceId) {
  if (!registry || typeof registry.getBySourceId !== 'function') {
    return undefined;
  }
  try {
    return registry.getBySourceId(sourceId);
  } catch {
    return undefined;
  }
}

function reconstructSupport(reference, registry = DEMO_REGISTRY) {
  const snapshot = sourceSnapshot(registry, reference.sourceId);
  let quotation = '';

  if (snapshot && typeof snapshot.canonicalText === 'string') {
    const bytes = Buffer.from(snapshot.canonicalText, 'utf8');
    if (
      Number.isSafeInteger(reference.start) &&
      Number.isSafeInteger(reference.end) &&
      reference.start >= 0 &&
      reference.end >= reference.start
    ) {
      quotation = bytes.subarray(reference.start, reference.end).toString('utf8');
    }
  }

  return Object.freeze({
    sourceId: reference.sourceId,
    sourceVersion: reference.sourceVersion,
    hashAlgorithm: reference.hashAlgorithm,
    contentHash: reference.contentHash,
    offsetUnit: reference.offsetUnit,
    start: reference.start,
    end: reference.end,
    quotation,
  });
}

function inspectManifest(manifest = DEMO_MANIFEST, registry = DEMO_REGISTRY) {
  const modelEntries = [];

  for (const reference of manifest) {
    const verification = verifyQuotation(reconstructSupport(reference, registry), registry);
    if (!verification.ok) {
      return Object.freeze({
        ok: false,
        referenceId: reference.referenceId,
        verification,
      });
    }

    modelEntries.push(Object.freeze({
      reference_id: reference.referenceId,
      label: reference.label,
      description: reference.description,
      excerpt: verification.evidence.extractedText,
    }));
  }

  return Object.freeze({
    ok: true,
    modelEntries: Object.freeze(modelEntries),
  });
}

function findReference(referenceId, manifest = DEMO_MANIFEST) {
  return manifest.find((entry) => entry.referenceId === referenceId);
}

module.exports = Object.freeze({
  DEMO_MANIFEST,
  DEMO_REGISTRY,
  PINNED_JPS_1917_SOURCES,
  PROVERBS_SOURCE,
  PSALMS_SOURCE,
  findReference,
  inspectManifest,
  reconstructSupport,
});
