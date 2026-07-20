'use strict';

const { VERIFIER_VERSION } = require('./constants');
const { createFailureResult } = require('./errors');
const { isNonBlankString } = require('./registry');
const { verifyQuotation } = require('./verifier');

function verifySupportedClaim(claim, registry) {
  const candidate = claim && typeof claim === 'object' ? claim : {};

  if (!isNonBlankString(candidate.claimId)) {
    return createFailureResult('INVALID_CLAIM_ID', { field: 'claimId' });
  }
  if (!Array.isArray(candidate.supports) || candidate.supports.length === 0) {
    return createFailureResult('UNSUPPORTED_CLAIM', { supportCount: 0 });
  }

  const evidence = [];
  for (let index = 0; index < candidate.supports.length; index += 1) {
    const result = verifyQuotation(candidate.supports[index], registry);
    if (!result.ok) {
      return createFailureResult('CLAIM_SUPPORT_INVALID', {
        supportIndex: index,
        causeCode: result.error.code,
      });
    }
    evidence.push(result.evidence);
  }

  return Object.freeze({
    ok: true,
    verifierVersion: VERIFIER_VERSION,
    claim: Object.freeze({
      claimId: candidate.claimId,
      supportCount: evidence.length,
      supports: Object.freeze(evidence),
    }),
  });
}

module.exports = Object.freeze({ verifySupportedClaim });
