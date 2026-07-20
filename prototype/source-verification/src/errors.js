'use strict';

const { VERIFIER_VERSION } = require('./constants');

const ERROR_MESSAGES = Object.freeze({
  INVALID_SOURCE_ID: 'sourceId must be a non-empty, non-whitespace string.',
  INVALID_SOURCE_VERSION: 'sourceVersion must be a non-empty, non-whitespace string.',
  INVALID_CANONICAL_TEXT: 'canonicalText must be a well-formed Unicode string.',
  SOURCE_ID_CONFLICT: 'sourceId is already bound to different immutable source content.',
  SOURCE_VERSION_CONFLICT: 'sourceId is already bound to a different immutable sourceVersion.',
  UNKNOWN_SOURCE: 'sourceId is not registered.',
  SOURCE_UNAVAILABLE: 'The source resolver or resolved snapshot is unavailable for verification.',
  STALE_SOURCE_VERSION: 'sourceVersion does not match the immutable registered source.',
  INVALID_HASH_ALGORITHM: 'hashAlgorithm must be sha256.',
  INVALID_CONTENT_HASH: 'contentHash must be a 64-character hexadecimal SHA-256 digest.',
  SOURCE_INTEGRITY_MISMATCH: 'The expected SHA-256 digest does not match the canonical source.',
  SOURCE_IDENTITY_MISMATCH: 'The quotation identity does not match the caller-bound identity.',
  INVALID_RANGE: 'The quotation range is invalid.',
  RANGE_OUT_OF_BOUNDS: 'The quotation range exceeds the UTF-8 source byte length.',
  RANGE_NOT_UTF8_BOUNDARY: 'A quotation range offset splits a UTF-8 sequence.',
  QUOTATION_MISMATCH: 'The exact extracted text does not equal the declared quotation.',
  INVALID_CLAIM_ID: 'claimId must be a non-empty, non-whitespace string.',
  UNSUPPORTED_CLAIM: 'A claim must declare at least one source support.',
  CLAIM_SUPPORT_INVALID: 'At least one declared source support failed verification.',
});

class SourceVerificationError extends Error {
  constructor(code, details = {}) {
    const message = ERROR_MESSAGES[code];
    if (!message) {
      throw new TypeError(`Unknown source-verification error code: ${code}`);
    }

    super(message);
    this.name = 'SourceVerificationError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

function createFailureResult(code, details = {}) {
  const message = ERROR_MESSAGES[code];
  if (!message) {
    throw new TypeError(`Unknown source-verification error code: ${code}`);
  }

  return Object.freeze({
    ok: false,
    verifierVersion: VERIFIER_VERSION,
    error: Object.freeze({
      code,
      message,
      details: Object.freeze({ ...details }),
    }),
  });
}

module.exports = Object.freeze({
  ERROR_MESSAGES,
  SourceVerificationError,
  createFailureResult,
});
