'use strict';

const { createHash } = require('node:crypto');
const { HASH_ALGORITHM } = require('./constants');
const { SourceVerificationError } = require('./errors');

function isNonBlankString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isWellFormedUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return false;
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }

  return true;
}

function sha256Utf8(text) {
  return createHash(HASH_ALGORITHM).update(Buffer.from(text, 'utf8')).digest('hex');
}

function validateRecord(record) {
  const candidate = record && typeof record === 'object' ? record : {};

  if (!isNonBlankString(candidate.sourceId)) {
    throw new SourceVerificationError('INVALID_SOURCE_ID', { field: 'sourceId' });
  }
  if (!isNonBlankString(candidate.sourceVersion)) {
    throw new SourceVerificationError('INVALID_SOURCE_VERSION', { field: 'sourceVersion' });
  }
  if (typeof candidate.canonicalText !== 'string' || !isWellFormedUnicode(candidate.canonicalText)) {
    throw new SourceVerificationError('INVALID_CANONICAL_TEXT', { field: 'canonicalText' });
  }

  return candidate;
}

function createSnapshot(record) {
  return Object.freeze({
    sourceId: record.sourceId,
    sourceVersion: record.sourceVersion,
    canonicalText: record.canonicalText,
    encoding: 'utf-8',
    newlinePolicy: 'preserve',
    hashAlgorithm: HASH_ALGORITHM,
    contentHash: sha256Utf8(record.canonicalText),
    byteLength: Buffer.byteLength(record.canonicalText, 'utf8'),
  });
}

class ImmutableSourceRegistry {
  #sources;

  constructor(records = []) {
    if (!Array.isArray(records)) {
      throw new TypeError('ImmutableSourceRegistry records must be an array.');
    }

    const sources = new Map();
    for (const rawRecord of records) {
      const record = validateRecord(rawRecord);
      const existing = sources.get(record.sourceId);

      if (existing) {
        if (existing.canonicalText !== record.canonicalText) {
          throw new SourceVerificationError('SOURCE_ID_CONFLICT', { sourceId: record.sourceId });
        }
        if (existing.sourceVersion !== record.sourceVersion) {
          throw new SourceVerificationError('SOURCE_VERSION_CONFLICT', { sourceId: record.sourceId });
        }
        continue;
      }

      sources.set(record.sourceId, createSnapshot(record));
    }

    this.#sources = sources;
    Object.freeze(this);
  }

  get size() {
    return this.#sources.size;
  }

  getBySourceId(sourceId) {
    return this.#sources.get(sourceId);
  }

  resolve(sourceId, sourceVersion) {
    const snapshot = this.#sources.get(sourceId);
    return snapshot && snapshot.sourceVersion === sourceVersion ? snapshot : undefined;
  }

  withSource(record) {
    const candidate = validateRecord(record);
    const existing = this.#sources.get(candidate.sourceId);

    if (existing) {
      if (existing.canonicalText !== candidate.canonicalText) {
        throw new SourceVerificationError('SOURCE_ID_CONFLICT', { sourceId: candidate.sourceId });
      }
      if (existing.sourceVersion !== candidate.sourceVersion) {
        throw new SourceVerificationError('SOURCE_VERSION_CONFLICT', { sourceId: candidate.sourceId });
      }
      return this;
    }

    const records = Array.from(this.#sources.values(), (snapshot) => ({
      sourceId: snapshot.sourceId,
      sourceVersion: snapshot.sourceVersion,
      canonicalText: snapshot.canonicalText,
    }));
    records.push(candidate);
    return new ImmutableSourceRegistry(records);
  }
}

module.exports = Object.freeze({
  ImmutableSourceRegistry,
  isNonBlankString,
  isWellFormedUnicode,
  sha256Utf8,
});
