'use strict';

const { Buffer } = require('node:buffer');
const {
  HASH_ALGORITHM,
  OFFSET_UNIT,
  ImmutableSourceRegistry,
  verifyQuotation,
} = require('../../source-verification/src');
const { SOURCES } = require('../../source-verification/test/fixtures');

const DEMO_SOURCE = SOURCES.hebrew;
const PINNED_CONTENT_HASH = 'fcfa677dfcfc2fba40060ed481414634c53f103714a09799397b081b5fa0acbc';
const DEMO_REGISTRY = new ImmutableSourceRegistry([DEMO_SOURCE]);

function freezeReference(reference) {
  return Object.freeze({
    referenceId: reference.referenceId,
    sourceId: DEMO_SOURCE.sourceId,
    sourceVersion: DEMO_SOURCE.sourceVersion,
    hashAlgorithm: HASH_ALGORITHM,
    contentHash: PINNED_CONTENT_HASH,
    offsetUnit: OFFSET_UNIT,
    start: reference.start,
    end: reference.end,
    label: reference.label,
    description: reference.description,
  });
}

const DEMO_MANIFEST = Object.freeze([
  freezeReference({
    referenceId: 'fixture-quoted-segment',
    start: 15,
    end: 25,
    label: 'Quoted Hebrew segment',
    description: 'The synthetic fixture segment inside Hebrew quotation marks.',
  }),
  freezeReference({
    referenceId: 'fixture-rtl-suffix',
    start: 44,
    end: 47,
    label: 'RTL suffix',
    description: 'The three-letter ASCII suffix after the right-to-left mark.',
  }),
  freezeReference({
    referenceId: 'fixture-full-source',
    start: 0,
    end: 47,
    label: 'Complete synthetic fixture',
    description: 'The complete synthetic Hebrew, niqqud, punctuation, number, and RTL fixture.',
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
      source_id: verification.evidence.sourceId,
      source_version: verification.evidence.sourceVersion,
      range: Object.freeze({
        start: verification.evidence.range.start,
        end: verification.evidence.range.end,
        offset_unit: verification.evidence.range.offsetUnit,
      }),
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
  DEMO_SOURCE,
  PINNED_CONTENT_HASH,
  findReference,
  inspectManifest,
  reconstructSupport,
});
