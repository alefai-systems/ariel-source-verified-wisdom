'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { inspectManifest } = require('../src/demo-manifest');
const { ArielDemoError } = require('../src/errors');
const {
  OpenAIResponsesClient,
  RESPONSES_ENDPOINT,
  parseResponsesPayload,
} = require('../src/model-clients');
const {
  ALLOWED_REFERENCE_IDS,
  MAX_OUTPUT_TOKENS,
  REASONING_EFFORT,
} = require('../src/model-contract');

const structuredOutput = Object.freeze({
  interpretation: 'A concise interpretation.',
  support_status: 'supported',
  citations: [Object.freeze({ reference_id: 'fixture-quoted-segment' })],
});
const modelManifest = inspectManifest().modelEntries;

function successfulPayload(output = structuredOutput) {
  return {
    status: 'completed',
    output: [{
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify(output) }],
    }],
  };
}

test('OpenAI client sends the bounded Responses API request exactly once', async () => {
  const secret = 'test-key-not-for-logs';
  let captured;
  const client = new OpenAIResponsesClient({
    apiKey: secret,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, json: async () => successfulPayload() };
    },
  });

  const output = await client.generate({ question: 'Inspect the fixture.', modelManifest });
  const body = JSON.parse(captured.options.body);

  assert.deepEqual(output, structuredOutput);
  assert.equal(captured.url, RESPONSES_ENDPOINT);
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers.Authorization, `Bearer ${secret}`);
  assert.equal(body.model, 'gpt-5.6-sol');
  assert.equal(body.store, false);
  assert.deepEqual(body.reasoning, { effort: REASONING_EFFORT });
  assert.equal(body.max_output_tokens, MAX_OUTPUT_TOKENS);
  assert.equal(body.text.format.type, 'json_schema');
  assert.equal(body.text.format.strict, true);
  assert.deepEqual(body.text.format.schema.properties.citations.items.properties.reference_id.enum, ALLOWED_REFERENCE_IDS);
  assert.equal(JSON.stringify(body).includes(secret), false);
});

test('OPENAI_MODEL-style constructor override changes only the server request model', async () => {
  let requestBody;
  const client = new OpenAIResponsesClient({
    apiKey: 'test-key',
    model: 'gpt-5.6-sol-snapshot',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, json: async () => successfulPayload() };
    },
  });

  await client.generate({ question: 'Inspect it.', modelManifest });
  assert.equal(requestBody.model, 'gpt-5.6-sol-snapshot');
});

test('missing API key fails before fetch', async () => {
  let fetchCalls = 0;
  const client = new OpenAIResponsesClient({
    fetchImpl: async () => {
      fetchCalls += 1;
    },
  });

  await assert.rejects(
    client.generate({ question: 'Inspect it.', modelManifest }),
    (error) => error instanceof ArielDemoError && error.code === 'MODEL_CONFIG_MISSING',
  );
  assert.equal(fetchCalls, 0);
});

test('refusal blocks even when output text is also present', () => {
  assert.throws(
    () => parseResponsesPayload({
      status: 'completed',
      output: [{
        type: 'message',
        content: [
          { type: 'output_text', text: JSON.stringify(structuredOutput) },
          { type: 'refusal', refusal: 'No.' },
        ],
      }],
    }),
    (error) => error.code === 'MODEL_REFUSAL',
  );
});

test('incomplete response is rejected without parsing partial output', () => {
  assert.throws(
    () => parseResponsesPayload({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [],
    }),
    (error) => error.code === 'MODEL_INCOMPLETE',
  );
});

test('code-fenced, empty, and multiple output blocks are malformed', () => {
  const malformedPayloads = [
    {
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '```json\n{}\n```' }] }],
    },
    { status: 'completed', output: [] },
    {
      status: 'completed',
      output: [{
        type: 'message',
        content: [
          { type: 'output_text', text: '{}' },
          { type: 'output_text', text: '{}' },
        ],
      }],
    },
  ];

  for (const payload of malformedPayloads) {
    assert.throws(
      () => parseResponsesPayload(payload),
      (error) => error.code === 'MODEL_RESPONSE_MALFORMED',
    );
  }
});

test('HTTP and transport failures are sanitized', async () => {
  const upstreamSecret = 'upstream-secret-body';
  const httpClient = new OpenAIResponsesClient({
    apiKey: 'test-key',
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => upstreamSecret,
    }),
  });
  const networkClient = new OpenAIResponsesClient({
    apiKey: 'test-key',
    fetchImpl: async () => {
      throw new Error(upstreamSecret);
    },
  });

  for (const [client, code] of [[httpClient, 'MODEL_HTTP_ERROR'], [networkClient, 'MODEL_UNAVAILABLE']]) {
    await assert.rejects(
      client.generate({ question: 'Inspect it.', modelManifest }),
      (error) => error.code === code && !error.message.includes(upstreamSecret),
    );
  }
});

test('timeout aborts the request and returns a stable error', async () => {
  const client = new OpenAIResponsesClient({
    apiKey: 'test-key',
    timeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('private timeout detail');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }),
  });

  await assert.rejects(
    client.generate({ question: 'Inspect it.', modelManifest }),
    (error) => error.code === 'MODEL_TIMEOUT' && !error.message.includes('private timeout detail'),
  );
});
