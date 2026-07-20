'use strict';

const { Buffer } = require('node:buffer');
const { ArielDemoError } = require('./errors');
const { DEFAULT_MODEL, buildResponsesRequest } = require('./model-contract');

const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_MODEL_OUTPUT_BYTES = 16 * 1024;

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
      return this.#resultFactory(context);
    }

    const question = context.question.toLowerCase();
    if (/weather|stock|price|authoritative|provenance/u.test(question)) {
      return {
        interpretation: 'The bounded synthetic fixture does not support that question.',
        support_status: 'unsupported',
        citations: [],
      };
    }

    if (/rtl|suffix/u.test(question)) {
      return {
        interpretation: 'The fixture ends with a short left-to-right label after a right-to-left control mark.',
        support_status: 'supported',
        citations: [{ reference_id: 'fixture-rtl-suffix' }],
      };
    }

    return {
      interpretation: 'The synthetic quoted segment combines a Hebrew word with niqqud, the number 42, and a question mark.',
      support_status: 'supported',
      citations: [{ reference_id: 'fixture-quoted-segment' }],
    };
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
      throw new ArielDemoError('MODEL_INCOMPLETE');
    }
    throw new ArielDemoError('MODEL_HTTP_ERROR');
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
    return JSON.parse(outputTexts[0]);
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
  parseResponsesPayload,
});
