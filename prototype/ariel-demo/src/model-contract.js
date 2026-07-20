'use strict';

const { ArielDemoError } = require('./errors');
const { DEMO_MANIFEST } = require('./demo-manifest');

const DEFAULT_MODEL = 'gpt-5.6-sol';
const REASONING_EFFORT = 'low';
const MAX_OUTPUT_TOKENS = 500;
const MAX_INTERPRETATION_LENGTH = 800;
const ALLOWED_REFERENCE_IDS = Object.freeze(DEMO_MANIFEST.map((entry) => entry.referenceId));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

const MODEL_OUTPUT_SCHEMA = deepFreeze({
  type: 'object',
  properties: {
    interpretation: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_INTERPRETATION_LENGTH,
    },
    support_status: {
      type: 'string',
      enum: ['supported', 'unsupported'],
    },
    citations: {
      type: 'array',
      maxItems: 1,
      items: {
        type: 'object',
        properties: {
          reference_id: { type: 'string', enum: ALLOWED_REFERENCE_IDS },
        },
        required: ['reference_id'],
        additionalProperties: false,
      },
    },
  },
  required: ['interpretation', 'support_status', 'citations'],
  additionalProperties: false,
});

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function malformed() {
  throw new ArielDemoError('MODEL_RESPONSE_MALFORMED');
}

function validateModelOutput(value, allowedReferenceIds) {
  if (!hasExactKeys(value, ['interpretation', 'support_status', 'citations'])) {
    malformed();
  }
  if (
    typeof value.interpretation !== 'string' ||
    value.interpretation.trim().length === 0 ||
    value.interpretation.length > MAX_INTERPRETATION_LENGTH
  ) {
    malformed();
  }
  if (!['supported', 'unsupported'].includes(value.support_status)) {
    malformed();
  }
  if (!Array.isArray(value.citations) || value.citations.length > 1) {
    malformed();
  }

  const citations = value.citations.map((citation) => {
    if (!hasExactKeys(citation, ['reference_id']) || typeof citation.reference_id !== 'string') {
      malformed();
    }
    if (!allowedReferenceIds.has(citation.reference_id)) {
      malformed();
    }
    return Object.freeze({ reference_id: citation.reference_id });
  });

  if (
    (value.support_status === 'supported' && citations.length !== 1) ||
    (value.support_status === 'unsupported' && citations.length !== 0)
  ) {
    malformed();
  }

  return Object.freeze({
    interpretation: value.interpretation,
    support_status: value.support_status,
    citations: Object.freeze(citations),
  });
}

function buildDeveloperPrompt(modelManifest) {
  return [
    'You are Ariel\'s bounded interpretation layer for a local source-verification demo.',
    'Answer only from the synthetic manifest below.',
    'Return support_status="supported" with exactly one allowed reference_id when one listed range supports the interpretation.',
    'Otherwise return support_status="unsupported" with an empty citations array.',
    'Do not invent provenance, source identifiers, ranges, or quotations.',
    'Keep interpretation concise and do not present a verbatim quotation; the server reconstructs any quotation independently.',
    'The fixture is synthetic test data and is not an authoritative wisdom source.',
    `Allowed manifest: ${JSON.stringify(modelManifest)}`,
  ].join('\n');
}

function buildResponsesRequest({ model = DEFAULT_MODEL, question, modelManifest }) {
  return {
    model,
    store: false,
    reasoning: { effort: REASONING_EFFORT },
    max_output_tokens: MAX_OUTPUT_TOKENS,
    input: [
      {
        role: 'developer',
        content: [{ type: 'input_text', text: buildDeveloperPrompt(modelManifest) }],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: question }],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'ariel_source_selection',
        strict: true,
        schema: MODEL_OUTPUT_SCHEMA,
      },
    },
  };
}

module.exports = Object.freeze({
  ALLOWED_REFERENCE_IDS,
  DEFAULT_MODEL,
  MAX_INTERPRETATION_LENGTH,
  MAX_OUTPUT_TOKENS,
  MODEL_OUTPUT_SCHEMA,
  REASONING_EFFORT,
  buildDeveloperPrompt,
  buildResponsesRequest,
  validateModelOutput,
});
