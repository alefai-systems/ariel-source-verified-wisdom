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

async function post(baseUrl, simulateTampering) {
  const response = await fetch(`${baseUrl}/api/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
    },
    body: JSON.stringify({
      question: 'What appears in the quoted segment of the synthetic Hebrew fixture?',
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
    const verified = await post(baseUrl, false);
    assert.equal(verified.ok, true);
    assert.equal(verified.exactQuotation, 'עֵץ 42?');

    const blocked = await post(baseUrl, true);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.verification.causeCode, 'QUOTATION_MISMATCH');
    assert.equal(Object.hasOwn(blocked, 'exactQuotation'), false);

    console.log(`[fake-demo] verified reference=${verified.sourceReference.referenceId} quote=${verified.exactQuotation}`);
    console.log(`[fake-demo] transparent-tampering blocked=${blocked.verification.code} cause=${blocked.verification.causeCode}`);
  } finally {
    await close(server);
  }
}

main().catch(() => {
  console.error('[fake-demo] failed');
  process.exitCode = 1;
});
