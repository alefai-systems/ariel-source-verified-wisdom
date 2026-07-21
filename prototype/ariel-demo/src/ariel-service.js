'use strict';

const { verifySupportedClaim } = require('../../source-verification/src');
const {
  DEMO_MANIFEST,
  DEMO_REGISTRY,
  findReference,
  inspectManifest,
  reconstructSupport,
} = require('./demo-manifest');
const { ArielDemoError } = require('./errors');
const { validateModelOutput } = require('./model-contract');

const MAX_QUESTION_LENGTH = 1_000;

function normalizeQuestion(question) {
  if (typeof question !== 'string') {
    throw new ArielDemoError('INVALID_QUESTION');
  }
  const normalized = question.trim();
  if (normalized.length === 0 || normalized.length > MAX_QUESTION_LENGTH) {
    throw new ArielDemoError('INVALID_QUESTION');
  }
  return normalized;
}

function safeModelMetadata(modelClient, responseStatus = null) {
  const metadata = {
    provider: typeof modelClient.provider === 'string' ? modelClient.provider : 'unknown',
    model: typeof modelClient.model === 'string' ? modelClient.model : 'unknown',
  };
  if (responseStatus !== null) {
    metadata.responseStatus = responseStatus;
  }
  return Object.freeze(metadata);
}

function publicReference(reference) {
  if (!reference) {
    return null;
  }
  return Object.freeze({
    referenceId: reference.referenceId,
    sourceId: reference.sourceId,
    sourceVersion: reference.sourceVersion,
    reference: reference.reference,
    altReference: reference.altReference,
    registeredSourceReference: reference.registeredSourceReference,
    versionTitle: reference.versionTitle,
    language: reference.language,
    license: reference.license,
    licenseNote: reference.licenseNote,
    provider: reference.provider,
    sourceUrl: reference.sourceUrl,
    retrievedAt: reference.retrievedAt,
    normalization: reference.normalization,
    sha256: reference.sha256,
    attribution: reference.attribution,
    segmentReferences: reference.segmentReferences,
    label: reference.label,
    range: Object.freeze({
      start: reference.start,
      end: reference.end,
      offsetUnit: reference.offsetUnit,
    }),
  });
}

function blockedResult({ model, code, causeCode = null, reference = null, simulatedTampering = false }) {
  return Object.freeze({
    ok: false,
    outcome: 'blocked',
    model,
    sourceReference: publicReference(reference),
    verification: Object.freeze({
      status: 'blocked',
      code,
      causeCode,
      simulatedTampering,
    }),
    message: 'Claim Gate blocked publication; no quotation was released.',
  });
}

class ArielService {
  #manifest;
  #modelClient;
  #registry;

  constructor({ modelClient, manifest = DEMO_MANIFEST, registry = DEMO_REGISTRY } = {}) {
    if (!modelClient || typeof modelClient.generate !== 'function') {
      throw new TypeError('ArielService requires a model client.');
    }
    if (!Array.isArray(manifest)) {
      throw new TypeError('ArielService manifest must be an array.');
    }
    this.#modelClient = modelClient;
    this.#manifest = manifest;
    this.#registry = registry;
    Object.freeze(this);
  }

  status() {
    return Object.freeze({
      ...safeModelMetadata(this.#modelClient),
      liveConfigured: this.#modelClient.liveConfigured === true,
      sourceCount: this.#registry && Number.isSafeInteger(this.#registry.size)
        ? this.#registry.size
        : 0,
      referenceCount: this.#manifest.length,
    });
  }

  async ask(question, { simulateTampering = false } = {}) {
    const safeQuestion = normalizeQuestion(question);
    let model = safeModelMetadata(this.#modelClient);
    const manifestInspection = inspectManifest(this.#manifest, this.#registry);

    if (!manifestInspection.ok) {
      return blockedResult({
        model,
        code: 'SOURCE_MANIFEST_INVALID',
        causeCode: manifestInspection.verification.error.code,
      });
    }

    const generation = await this.#modelClient.generate({
      question: safeQuestion,
      modelManifest: manifestInspection.modelEntries,
    });
    if (
      !generation ||
      typeof generation !== 'object' ||
      generation.responseStatus !== 'completed' ||
      !Object.hasOwn(generation, 'modelOutput')
    ) {
      throw new ArielDemoError('MODEL_STATUS_NOT_COMPLETED');
    }
    model = safeModelMetadata(this.#modelClient, generation.responseStatus);
    const allowedReferenceIds = new Set(this.#manifest.map((entry) => entry.referenceId));
    const modelOutput = validateModelOutput(generation.modelOutput, allowedReferenceIds);

    if (modelOutput.support_status === 'unsupported') {
      return blockedResult({ model, code: 'UNSUPPORTED_CLAIM' });
    }

    const reference = findReference(modelOutput.citations[0].reference_id, this.#manifest);
    let support = reconstructSupport(reference, this.#registry);
    if (simulateTampering) {
      support = Object.freeze({
        ...support,
        quotation: `${support.quotation} [simulated post-model tampering]`,
      });
    }

    const gate = verifySupportedClaim({
      claimId: `ariel-demo:${reference.referenceId}`,
      supports: [support],
    }, this.#registry);

    if (!gate.ok) {
      return blockedResult({
        model,
        code: gate.error.code,
        causeCode: gate.error.details.causeCode || null,
        reference,
        simulatedTampering: simulateTampering,
      });
    }

    const evidence = gate.claim.supports[0];
    return Object.freeze({
      ok: true,
      outcome: 'verified',
      model,
      interpretation: modelOutput.interpretation,
      sourceReference: publicReference(reference),
      exactQuotation: evidence.extractedText,
      verification: Object.freeze({
        status: 'verified',
        verifierVersion: gate.verifierVersion,
        integrity: Object.freeze({
          passed: true,
          hashAlgorithm: evidence.hashAlgorithm,
          contentHash: evidence.contentHash,
        }),
        simulatedTampering: false,
      }),
      provenance: reference.attribution,
      limitation: 'Claim Gate verifies the pinned identity, bytes, range, and quotation only. It does not establish semantic entailment or source authority; Sefaria does not verify the interpretation, and SHA-256 only detects byte changes.',
    });
  }
}

module.exports = Object.freeze({
  ArielService,
  MAX_QUESTION_LENGTH,
  blockedResult,
  normalizeQuestion,
});
