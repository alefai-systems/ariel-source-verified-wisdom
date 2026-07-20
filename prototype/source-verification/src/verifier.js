'use strict';

const { Buffer } = require('node:buffer');
const { HASH_ALGORITHM, OFFSET_UNIT, VERIFIER_VERSION } = require('./constants');
const { createFailureResult } = require('./errors');
const { isNonBlankString, isWellFormedUnicode, sha256Utf8 } = require('./registry');

function utf8Boundaries(text) {
  const boundaries = new Set([0]);
  let offset = 0;

  for (const symbol of text) {
    offset += Buffer.byteLength(symbol, 'utf8');
    boundaries.add(offset);
  }

  return boundaries;
}

function verifyQuotation(claim, registry) {
  const candidate = claim && typeof claim === 'object' ? claim : {};

  if (!isNonBlankString(candidate.sourceId)) {
    return createFailureResult('INVALID_SOURCE_ID', { field: 'sourceId' });
  }
  if (!isNonBlankString(candidate.sourceVersion)) {
    return createFailureResult('INVALID_SOURCE_VERSION', { field: 'sourceVersion' });
  }

  if (!registry || typeof registry.getBySourceId !== 'function') {
    return createFailureResult('SOURCE_UNAVAILABLE', { reason: 'RESOLVER_INTERFACE_MISSING' });
  }

  let snapshot;
  try {
    snapshot = registry.getBySourceId(candidate.sourceId);
  } catch {
    return createFailureResult('SOURCE_UNAVAILABLE', { reason: 'RESOLUTION_FAILED' });
  }

  if (snapshot === undefined) {
    return createFailureResult('UNKNOWN_SOURCE', { sourceId: candidate.sourceId });
  }

  let resolvedSourceId;
  let resolvedSourceVersion;
  let canonicalText;
  let recordedHashAlgorithm;
  let recordedContentHash;
  let sourceBytes;
  try {
    if (!snapshot || typeof snapshot !== 'object') {
      return createFailureResult('SOURCE_UNAVAILABLE', { reason: 'MALFORMED_SNAPSHOT' });
    }

    resolvedSourceId = snapshot.sourceId;
    resolvedSourceVersion = snapshot.sourceVersion;
    canonicalText = snapshot.canonicalText;
    recordedHashAlgorithm = snapshot.hashAlgorithm;
    recordedContentHash = snapshot.contentHash;

    if (
      !isNonBlankString(resolvedSourceId) ||
      !isNonBlankString(resolvedSourceVersion) ||
      typeof canonicalText !== 'string' ||
      !isWellFormedUnicode(canonicalText) ||
      recordedHashAlgorithm !== HASH_ALGORITHM ||
      typeof recordedContentHash !== 'string' ||
      !/^[0-9a-fA-F]{64}$/.test(recordedContentHash)
    ) {
      return createFailureResult('SOURCE_UNAVAILABLE', { reason: 'MALFORMED_SNAPSHOT' });
    }

    sourceBytes = Buffer.from(canonicalText, 'utf8');
  } catch {
    return createFailureResult('SOURCE_UNAVAILABLE', { reason: 'MALFORMED_SNAPSHOT' });
  }

  if (resolvedSourceId !== candidate.sourceId) {
    return createFailureResult('SOURCE_IDENTITY_MISMATCH', {
      requestedSourceId: candidate.sourceId,
      resolvedSourceId,
    });
  }
  if (resolvedSourceVersion !== candidate.sourceVersion) {
    return createFailureResult('STALE_SOURCE_VERSION', {
      sourceId: candidate.sourceId,
      sourceVersion: candidate.sourceVersion,
    });
  }

  if (candidate.expectedIdentity !== undefined) {
    const expected = candidate.expectedIdentity;
    if (
      !expected ||
      typeof expected !== 'object' ||
      expected.sourceId !== resolvedSourceId ||
      expected.sourceVersion !== resolvedSourceVersion
    ) {
      return createFailureResult('SOURCE_IDENTITY_MISMATCH', {
        resolvedSourceId,
        resolvedSourceVersion,
      });
    }
  }

  if (candidate.hashAlgorithm !== HASH_ALGORITHM) {
    return createFailureResult('INVALID_HASH_ALGORITHM', { expected: HASH_ALGORITHM });
  }
  if (typeof candidate.contentHash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(candidate.contentHash)) {
    return createFailureResult('INVALID_CONTENT_HASH', { field: 'contentHash' });
  }

  const actualHash = sha256Utf8(canonicalText);
  if (
    actualHash !== recordedContentHash.toLowerCase() ||
    candidate.contentHash.toLowerCase() !== actualHash
  ) {
    return createFailureResult('SOURCE_INTEGRITY_MISMATCH', {
      sourceId: resolvedSourceId,
      sourceVersion: resolvedSourceVersion,
    });
  }

  if (candidate.offsetUnit !== OFFSET_UNIT) {
    return createFailureResult('INVALID_RANGE', {
      field: 'offsetUnit',
      expected: OFFSET_UNIT,
    });
  }

  if (!Number.isSafeInteger(candidate.start) || !Number.isSafeInteger(candidate.end)) {
    return createFailureResult('INVALID_RANGE', { reason: 'UNSAFE_OR_NON_INTEGER' });
  }
  if (candidate.start < 0 || candidate.end < 0) {
    return createFailureResult('INVALID_RANGE', { reason: 'NEGATIVE_OFFSET' });
  }
  if (candidate.start === candidate.end) {
    return createFailureResult('INVALID_RANGE', { reason: 'EMPTY_RANGE' });
  }
  if (candidate.start > candidate.end) {
    return createFailureResult('INVALID_RANGE', { reason: 'REVERSED_RANGE' });
  }
  const sourceByteLength = sourceBytes.length;
  if (candidate.start > sourceByteLength || candidate.end > sourceByteLength) {
    return createFailureResult('RANGE_OUT_OF_BOUNDS', { sourceByteLength });
  }

  const boundaries = utf8Boundaries(canonicalText);
  if (!boundaries.has(candidate.start) || !boundaries.has(candidate.end)) {
    return createFailureResult('RANGE_NOT_UTF8_BOUNDARY', {
      startBoundary: boundaries.has(candidate.start),
      endBoundary: boundaries.has(candidate.end),
    });
  }

  const extractedText = sourceBytes.subarray(candidate.start, candidate.end).toString('utf8');
  if (typeof candidate.quotation !== 'string' || extractedText !== candidate.quotation) {
    return createFailureResult('QUOTATION_MISMATCH', {
      start: candidate.start,
      end: candidate.end,
    });
  }

  const range = Object.freeze({
    start: candidate.start,
    end: candidate.end,
    offsetUnit: OFFSET_UNIT,
  });
  const evidence = Object.freeze({
    sourceId: resolvedSourceId,
    sourceVersion: resolvedSourceVersion,
    hashAlgorithm: HASH_ALGORITHM,
    contentHash: actualHash,
    sourceByteLength,
    range,
    quotation: candidate.quotation,
    extractedText,
  });

  return Object.freeze({
    ok: true,
    verifierVersion: VERIFIER_VERSION,
    evidence,
  });
}

module.exports = Object.freeze({
  utf8Boundaries,
  verifyQuotation,
});
