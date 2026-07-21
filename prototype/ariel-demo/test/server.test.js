'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { ArielService } = require('../src/ariel-service');
const { FakeModelClient, OpenAIResponsesClient } = require('../src/model-clients');
const {
  LOCAL_HOST,
  createArielServer,
  createRuntimeService,
  listen,
} = require('../src/server');

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function withServer(service, callback) {
  const server = createArielServer({ service });
  const address = await listen(server, { host: LOCAL_HOST, port: 0 });
  const baseUrl = `http://${LOCAL_HOST}:${address.port}`;
  try {
    return await callback(baseUrl);
  } finally {
    await close(server);
  }
}

async function post(baseUrl, body, headers = {}) {
  return fetch(`${baseUrl}/api/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test('server exposes only safe local runtime metadata and static UI', async () => {
  const service = new ArielService({ modelClient: new FakeModelClient() });

  await withServer(service, async (baseUrl) => {
    const statusResponse = await fetch(`${baseUrl}/api/status`);
    const status = await statusResponse.json();
    const pageResponse = await fetch(baseUrl);
    const page = await pageResponse.text();

    assert.equal(statusResponse.status, 200);
    assert.deepEqual(status, {
      ok: true,
      provider: 'fake',
      model: 'deterministic-fake',
      liveConfigured: false,
      sourceCount: 2,
      referenceCount: 2,
    });
    assert.equal(pageResponse.status, 200);
    assert.match(page, /Ariel: Source-Verified Wisdom/u);
    assert.match(page, /JPS 1917/u);
    assert.match(page, /Model-generated interpretation/u);
    assert.match(page, /Deterministically verified quotation/u);
    assert.match(
      page,
      /The quotation is deterministically verified\. The interpretation is model-generated and is not semantically verified\./u,
    );
    assert.match(pageResponse.headers.get('content-security-policy'), /default-src 'self'/u);
  });
});

test('HTTP verified path and transparent attack path both fail or publish as designed', async () => {
  const service = new ArielService({ modelClient: new FakeModelClient() });

  await withServer(service, async (baseUrl) => {
    const verifiedResponse = await post(baseUrl, {
      question: 'What does it mean for truth to spring from the earth?',
      simulateTampering: false,
    });
    const verified = await verifiedResponse.json();
    const blockedResponse = await post(baseUrl, {
      question: 'What does it mean for truth to spring from the earth?',
      simulateTampering: true,
    });
    const blocked = await blockedResponse.json();

    assert.equal(verifiedResponse.status, 200);
    assert.equal(verified.ok, true);
    assert.equal(
      verified.exactQuotation,
      'Truth springeth out of the earth; And righteousness hath looked down from heaven.',
    );
    assert.equal(verified.sourceReference.reference, 'Psalms 85:12');
    assert.equal(
      verified.sourceReference.altReference,
      'Psalm 85:11 (common Christian/KJV numbering)',
    );
    assert.equal(verified.sourceReference.license, 'Public Domain');
    assert.equal(verified.sourceReference.provider, 'Sefaria');
    assert.equal(blockedResponse.status, 200);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.verification.causeCode, 'QUOTATION_MISMATCH');
    assert.equal(Object.hasOwn(blocked, 'exactQuotation'), false);
  });
});

test('browser request cannot select provider, model, endpoint, or API key', async () => {
  const service = new ArielService({ modelClient: new FakeModelClient() });

  await withServer(service, async (baseUrl) => {
    for (const forbidden of ['provider', 'model', 'endpoint', 'apiKey']) {
      const response = await post(baseUrl, {
        question: 'Inspect it.',
        [forbidden]: 'not-allowed',
      });
      const payload = await response.json();

      assert.equal(response.status, 400);
      assert.equal(payload.error.code, 'INVALID_REQUEST');
    }
  });
});

test('missing live API key returns a safe browser error and never calls fetch', async () => {
  let fetchCalls = 0;
  const client = new OpenAIResponsesClient({
    fetchImpl: async () => {
      fetchCalls += 1;
    },
  });
  const service = new ArielService({ modelClient: client });

  await withServer(service, async (baseUrl) => {
    const response = await post(baseUrl, { question: 'Inspect it.' });
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.error.code, 'MODEL_CONFIG_MISSING');
    assert.equal(fetchCalls, 0);
  });
});

test('browser responses and static assets never include the server API key', async () => {
  const secret = 'sentinel-openai-key-never-for-browser';
  const client = new OpenAIResponsesClient({
    apiKey: secret,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        status: 'completed',
        output: [{
          type: 'message',
          content: [{
            type: 'output_text',
            text: JSON.stringify({
              interpretation: 'A safe interpretation.',
              support_status: 'supported',
              citations: [{ reference_id: 'jps-source-a' }],
            }),
          }],
        }],
      }),
    }),
  });
  const service = new ArielService({ modelClient: client });

  await withServer(service, async (baseUrl) => {
    const statusText = await (await fetch(`${baseUrl}/api/status`)).text();
    const pageText = await (await fetch(baseUrl)).text();
    const scriptText = await (await fetch(`${baseUrl}/app.js`)).text();
    const resultText = await (await post(baseUrl, { question: 'Inspect it.' })).text();
    const browserVisible = [statusText, pageText, scriptText, resultText].join('\n');

    assert.equal(browserVisible.includes(secret), false);
    assert.equal(JSON.parse(statusText).liveConfigured, true);
    assert.equal(JSON.parse(resultText).ok, true);
  });
});

test('runtime factory does not retain the API key in its public configuration', () => {
  const secret = 'runtime-secret-not-retained';
  const runtime = createRuntimeService({
    environment: {
      ARIEL_MODEL_PROVIDER: 'openai',
      OPENAI_API_KEY: secret,
      OPENAI_MODEL: 'gpt-5.6-sol',
      ARIEL_PORT: '3000',
    },
    fetchImpl: async () => {
      throw new Error('not called');
    },
  });

  assert.equal(Object.hasOwn(runtime.config, 'apiKey'), false);
  assert.equal(JSON.stringify(runtime).includes(secret), false);
});

test('wrong-origin JSON request is rejected before model generation', async () => {
  let modelCalls = 0;
  const service = new ArielService({
    modelClient: new FakeModelClient({
      resultFactory: async () => {
        modelCalls += 1;
        return {
          interpretation: 'Should not run.',
          support_status: 'unsupported',
          citations: [],
        };
      },
    }),
  });

  await withServer(service, async (baseUrl) => {
    const response = await post(baseUrl, { question: 'Inspect it.' }, {
      Origin: 'https://example.invalid',
    });

    assert.equal(response.status, 400);
    assert.equal(modelCalls, 0);
  });
});

test('matching non-loopback Host and Origin cannot pass through DNS rebinding', async () => {
  let modelCalls = 0;
  const service = new ArielService({
    modelClient: new FakeModelClient({
      resultFactory: async () => {
        modelCalls += 1;
        return {
          interpretation: 'Should not run.',
          support_status: 'unsupported',
          citations: [],
        };
      },
    }),
  });

  await withServer(service, async (baseUrl) => {
    const port = new URL(baseUrl).port;
    const reboundAuthority = `attacker.invalid:${port}`;
    const response = await post(baseUrl, { question: 'Inspect it.' }, {
      Host: reboundAuthority,
      Origin: `http://${reboundAuthority}`,
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, 'INVALID_REQUEST');
    assert.equal(modelCalls, 0);
  });
});
