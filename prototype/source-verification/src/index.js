'use strict';

const constants = require('./constants');
const { SourceVerificationError } = require('./errors');
const { ImmutableSourceRegistry, sha256Utf8 } = require('./registry');
const { verifyQuotation } = require('./verifier');
const { verifySupportedClaim } = require('./claims');

module.exports = Object.freeze({
  ...constants,
  ImmutableSourceRegistry,
  SourceVerificationError,
  sha256Utf8,
  verifyQuotation,
  verifySupportedClaim,
});
