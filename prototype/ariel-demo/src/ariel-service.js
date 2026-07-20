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

function safeModelMetadata(modelClient) {
  return Object.freeze({
    provider: typeof modelClient.provider === 'string' ? modelClient.provider : 'unknown',
    model: typeof modelClient.model === 'string' ? modelClient.model : 'unknown',
  });
}

function publicReference(reference) {
  if (!reference) {
    return null;
  }
  return Object.freeze({
    referenceId: reference.referenceId,
    sourceId: reference.sourceId,
    sourceVersion: reference.sourceVersion,
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
      sourceCount: 1,
      referenceCount: this.#manifest.length,
    });
  }

  async ask(question, { simulateTampering = false } = {}) {
    const safeQuestion = normalizeQuestion(question);
    const model = safeModelMetadata(this.#modelClient);
    const manifestInspection = inspectManifest(this.#manifest, this.#registry);

    if (!manifestInspection.ok) {
      return blockedResult({
        model,
        code: 'SOURCE_MANIFEST_INVALID',
        causeCode: manifestInspection.verification.error.code,
      });
    }

    const rawModelOutput = await this.#modelClient.generate({
      question: safeQuestion,
      modelManifest: manifestInspection.modelEntries,
    });
    const allowedReferenceIds = new Set(this.#manifest.map((entry) => entry.referenceId));
    const modelOutput = validateModelOutput(rawModelOutput, allowedReferenceIds);

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
      provenance: 'Synthetic Hebrew/Unicode test fixture; no authoritative provenance is claimed.',
      limitation: 'Exact source support is verified; semantic entailment of the model interpretation is not.',
    });
  }
}

module.exports = Object.freeze({
  ArielService,
  MAX_QUESTION_LENGTH,
  blockedResult,
  normalizeQuestion,
});
