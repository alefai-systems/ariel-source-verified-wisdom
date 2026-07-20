'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { ArielService } = require('../src/ariel-service');
const { DEMO_MANIFEST } = require('../src/demo-manifest');
const { ArielDemoError } = require('../src/errors');
const { FakeModelClient } = require('../src/model-clients');

function supportedOutput(interpretation = 'A bounded interpretation.') {
  return {
    interpretation,
    support_status: 'supported',
    citations: [{ reference_id: 'fixture-quoted-segment' }],
  };
}

function serviceFor(output) {
  return new ArielService({
    modelClient: new FakeModelClient({ resultFactory: async () => output }),
  });
}

test('fake model structured success passes through the existing Claim Gate', async () => {
  const result = await serviceFor(supportedOutput()).ask('What is in the quoted segment?');

  assert.equal(result.ok, true);
  assert.equal(result.outcome, 'verified');
  assert.equal(result.exactQuotation, 'עֵץ 42?');
  assert.equal(result.verification.integrity.passed, true);
  assert.equal(result.sourceReference.referenceId, 'fixture-quoted-segment');
});

test('final quotation comes from registry evidence, not model text', async () => {
  const modelText = 'MODEL-CONTROLLED-QUOTE: עֵץ 99?';
  const result = await serviceFor(supportedOutput(modelText)).ask('Inspect the segment.');

  assert.equal(result.ok, true);
  assert.equal(result.interpretation, modelText);
  assert.equal(result.exactQuotation, 'עֵץ 42?');
  assert.notEqual(result.exactQuotation, modelText);
});

test('a model-supplied quotation field makes the entire output malformed', async () => {
  const output = { ...supportedOutput(), quotation: 'model quote' };

  await assert.rejects(
    serviceFor(output).ask('Inspect the segment.'),
    (error) => error instanceof ArielDemoError && error.code === 'MODEL_RESPONSE_MALFORMED',
  );
});

test('unsupported model output is blocked without publishing prose or a quotation', async () => {
  const result = await serviceFor({
    interpretation: 'The fixture does not support this.',
    support_status: 'unsupported',
    citations: [],
  }).ask('What is the weather?');

  assert.equal(result.ok, false);
  assert.equal(result.verification.code, 'UNSUPPORTED_CLAIM');
  assert.equal(Object.hasOwn(result, 'interpretation'), false);
  assert.equal(Object.hasOwn(result, 'exactQuotation'), false);
});

test('transparent post-model quotation tampering is blocked by exact comparison', async () => {
  const result = await serviceFor(supportedOutput()).ask('Inspect the segment.', {
    simulateTampering: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.verification.code, 'CLAIM_SUPPORT_INVALID');
  assert.equal(result.verification.causeCode, 'QUOTATION_MISMATCH');
  assert.equal(result.verification.simulatedTampering, true);
  assert.equal(Object.hasOwn(result, 'exactQuotation'), false);
});

test('manifest reference to an unknown source blocks before model generation', async () => {
  let modelCalls = 0;
  const modelClient = new FakeModelClient({
    resultFactory: async () => {
      modelCalls += 1;
      return supportedOutput();
    },
  });
  const manifest = [Object.freeze({
    ...DEMO_MANIFEST[0],
    sourceId: 'unknown-source',
  })];
  const result = await new ArielService({ modelClient, manifest }).ask('Inspect it.');

  assert.equal(result.ok, false);
  assert.equal(result.verification.code, 'SOURCE_MANIFEST_INVALID');
  assert.equal(result.verification.causeCode, 'UNKNOWN_SOURCE');
  assert.equal(modelCalls, 0);
  assert.equal(Object.hasOwn(result, 'exactQuotation'), false);
});

test('manifest reference with an invalid range blocks before model generation', async () => {
  const manifest = [Object.freeze({
    ...DEMO_MANIFEST[0],
    start: 15,
    end: 15,
  })];
  const result = await new ArielService({
    modelClient: new FakeModelClient(),
    manifest,
  }).ask('Inspect it.');

  assert.equal(result.ok, false);
  assert.equal(result.verification.code, 'SOURCE_MANIFEST_INVALID');
  assert.equal(result.verification.causeCode, 'INVALID_RANGE');
  assert.equal(Object.hasOwn(result, 'exactQuotation'), false);
});

test('malformed model output is rejected even when produced by an injected client', async () => {
  await assert.rejects(
    serviceFor({ interpretation: 'Missing required fields.' }).ask('Inspect it.'),
    (error) => error instanceof ArielDemoError && error.code === 'MODEL_RESPONSE_MALFORMED',
  );
});

test('question validation is bounded before model invocation', async () => {
  await assert.rejects(
    serviceFor(supportedOutput()).ask('   '),
    (error) => error instanceof ArielDemoError && error.code === 'INVALID_QUESTION',
  );
});
