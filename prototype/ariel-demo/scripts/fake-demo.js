'use strict';

const assert = require('node:assert/strict');
const { ArielService } = require('../src/ariel-service');
const { FakeModelClient } = require('../src/model-clients');
const { LOCAL_HOST, createArielServer, listen } = require('../src/server');

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function post(baseUrl, question, simulateTampering) {
  const response = await fetch(`${baseUrl}/api/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
    },
    body: JSON.stringify({
      question,
      simulateTampering,
    }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function main() {
  const service = new ArielService({ modelClient: new FakeModelClient() });
  const server = createArielServer({ service });
  const address = await listen(server, { host: LOCAL_HOST, port: 0 });
  const baseUrl = `http://${LOCAL_HOST}:${address.port}`;

  try {
    const verified = await post(
      baseUrl,
      'What does it mean for truth to spring from the earth?',
      false,
    );
    assert.equal(verified.ok, true);
    assert.equal(
      verified.exactQuotation,
      'Truth springeth out of the earth; And righteousness hath looked down from heaven.',
    );
    assert.equal(verified.sourceReference.reference, 'Psalms 85:12');

    const proverb = await post(baseUrl, 'What does Proverbs say about a truthful lip?', false);
    assert.equal(proverb.ok, true);
    assert.equal(
      proverb.exactQuotation,
      'The lip of truth shall be established for ever; But a lying tongue is but for a moment.',
    );

    const blocked = await post(
      baseUrl,
      'What does it mean for truth to spring from the earth?',
      true,
    );
    assert.equal(blocked.ok, false);
    assert.equal(blocked.verification.causeCode, 'QUOTATION_MISMATCH');
    assert.equal(Object.hasOwn(blocked, 'exactQuotation'), false);

    console.log(`[fake-demo] verified reference=${verified.sourceReference.referenceId} quote=${verified.exactQuotation}`);
    console.log(`[fake-demo] second-reference=${proverb.sourceReference.referenceId} quote=${proverb.exactQuotation}`);
    console.log(`[fake-demo] transparent-tampering blocked=${blocked.verification.code} cause=${blocked.verification.causeCode}`);
  } finally {
    await close(server);
  }
}

main().catch(() => {
  console.error('[fake-demo] failed');
  process.exitCode = 1;
});
