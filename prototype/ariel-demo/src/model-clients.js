'use strict';

const { Buffer } = require('node:buffer');
const { ArielDemoError } = require('./errors');
const { DEFAULT_MODEL, buildResponsesRequest } = require('./model-contract');

const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_MODEL_OUTPUT_BYTES = 16 * 1024;

function completedGeneration(modelOutput) {
  return Object.freeze({
    responseStatus: 'completed',
    modelOutput,
  });
}

class FakeModelClient {
  #resultFactory;

  constructor({ resultFactory } = {}) {
    this.#resultFactory = resultFactory;
    this.provider = 'fake';
    this.model = 'deterministic-fake';
    this.liveConfigured = false;
    Object.freeze(this);
  }

  async generate(context) {
    if (this.#resultFactory) {
      return completedGeneration(await this.#resultFactory(context));
    }

    const question = context.question.toLowerCase();
    if (/weather|stock|price|authoritative|provenance/u.test(question)) {
      return completedGeneration({
        interpretation: 'The bounded JPS 1917 corpus does not support that question.',
        support_status: 'unsupported',
        citations: [],
      });
    }

    if (/lip|tongue|proverb|moment|established|speech/u.test(question)) {
      return completedGeneration({
        interpretation: 'Truthful speech is portrayed as enduring, while falsehood is temporary.',
        support_status: 'supported',
        citations: [{ reference_id: 'jps-source-b' }],
      });
    }

    return completedGeneration({
      interpretation: 'Truth is pictured as rising from the human world while righteousness answers from above.',
      support_status: 'supported',
      citations: [{ reference_id: 'jps-source-a' }],
    });
  }
}

class OpenAIResponsesClient {
  #apiKey;
  #endpoint;
  #fetchImpl;
  #timeoutMs;

  constructor({
    apiKey,
    model = DEFAULT_MODEL,
    fetchImpl = globalThis.fetch,
    endpoint = RESPONSES_ENDPOINT,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    this.#apiKey = apiKey;
    this.#endpoint = endpoint;
    this.#fetchImpl = fetchImpl;
    this.#timeoutMs = timeoutMs;
    this.provider = 'openai';
    this.model = typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_MODEL;
    this.liveConfigured = typeof apiKey === 'string' && apiKey.trim().length > 0;
    Object.freeze(this);
  }

  async generate({ question, modelManifest }) {
    if (!this.liveConfigured) {
      throw new ArielDemoError('MODEL_CONFIG_MISSING');
    }
    if (typeof this.#fetchImpl !== 'function') {
      throw new ArielDemoError('MODEL_UNAVAILABLE');
    }

    const requestBody = buildResponsesRequest({
      model: this.model,
      question,
      modelManifest,
    });
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.#timeoutMs);

    let response;
    try {
      response = await this.#fetchImpl(this.#endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted || (error && error.name === 'AbortError')) {
        throw new ArielDemoError('MODEL_TIMEOUT');
      }
      throw new ArielDemoError('MODEL_UNAVAILABLE');
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!response || response.ok !== true) {
      throw new ArielDemoError('MODEL_HTTP_ERROR');
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ArielDemoError('MODEL_RESPONSE_MALFORMED');
    }

    return parseResponsesPayload(payload);
  }
}

function parseResponsesPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ArielDemoError('MODEL_RESPONSE_MALFORMED');
  }
  if (payload.status !== 'completed') {
    if (payload.status === 'incomplete') {
      const reason = payload.incomplete_details && typeof payload.incomplete_details.reason === 'string'
        ? payload.incomplete_details.reason
        : null;
      throw new ArielDemoError('MODEL_INCOMPLETE', { reason });
    }
    throw new ArielDemoError('MODEL_STATUS_NOT_COMPLETED');
  }
  if (!Array.isArray(payload.output)) {
    throw new ArielDemoError('MODEL_RESPONSE_MALFORMED');
  }

  const outputTexts = [];
  let refused = false;
  for (const output of payload.output) {
    if (!output || output.type !== 'message' || !Array.isArray(output.content)) {
      continue;
    }
    for (const item of output.content) {
      if (item && item.type === 'refusal') {
        refused = true;
      } else if (item && item.type === 'output_text' && typeof item.text === 'string') {
        outputTexts.push(item.text);
      }
    }
  }

  if (refused) {
    throw new ArielDemoError('MODEL_REFUSAL');
  }
  if (outputTexts.length === 0 && typeof payload.output_text === 'string') {
    outputTexts.push(payload.output_text);
  }
  if (outputTexts.length !== 1 || Buffer.byteLength(outputTexts[0], 'utf8') > MAX_MODEL_OUTPUT_BYTES) {
    throw new ArielDemoError('MODEL_RESPONSE_MALFORMED');
  }

  try {
    return completedGeneration(JSON.parse(outputTexts[0]));
  } catch {
    throw new ArielDemoError('MODEL_RESPONSE_MALFORMED');
  }
}

module.exports = Object.freeze({
  DEFAULT_TIMEOUT_MS,
  FakeModelClient,
  MAX_MODEL_OUTPUT_BYTES,
  OpenAIResponsesClient,
  RESPONSES_ENDPOINT,
  completedGeneration,
  parseResponsesPayload,
});
