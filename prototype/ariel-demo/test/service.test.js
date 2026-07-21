'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { ArielService } = require('../src/ariel-service');
const { DEMO_MANIFEST } = require('../src/demo-manifest');
const { ArielDemoError } = require('../src/errors');
const { FakeModelClient } = require('../src/model-clients');

function supportedOutput(
  interpretation = 'A bounded interpretation.',
  referenceId = 'jps-source-a',
) {
  return {
    interpretation,
    support_status: 'supported',
    citations: [{ reference_id: referenceId }],
  };
}

function serviceFor(output) {
  return new ArielService({
    modelClient: new FakeModelClient({ resultFactory: async () => output }),
  });
}

test('fake model success passes through the existing Claim Gate for Psalm 85:12', async () => {
  const result = await serviceFor(supportedOutput()).ask('What does truth springing mean?');

  assert.equal(result.ok, true);
  assert.equal(result.outcome, 'verified');
  assert.equal(
    result.exactQuotation,
    'Truth springeth out of the earth; And righteousness hath looked down from heaven.',
  );
  assert.equal(result.verification.integrity.passed, true);
  assert.equal(result.sourceReference.referenceId, 'jps-source-a');
  assert.equal(result.sourceReference.reference, 'Psalms 85:12');
  assert.equal(
    result.sourceReference.altReference,
    'Psalm 85:11 (common Christian/KJV numbering)',
  );
  assert.equal(result.sourceReference.versionTitle, 'The Holy Scriptures: A New Translation (JPS 1917)');
  assert.equal(result.sourceReference.license, 'Public Domain');
  assert.equal(result.sourceReference.provider, 'Sefaria');
  assert.equal(result.model.responseStatus, 'completed');
});

test('Proverbs 12:19 verifies as the second bounded source', async () => {
  const result = await serviceFor(supportedOutput('Truthful speech endures.', 'jps-source-b'))
    .ask('What does Proverbs say about a truthful lip?');

  assert.equal(result.ok, true);
  assert.equal(result.sourceReference.reference, 'Proverbs 12:19');
  assert.equal(result.sourceReference.altReference, null);
  assert.equal(
    result.exactQuotation,
    'The lip of truth shall be established for ever; But a lying tongue is but for a moment.',
  );
});

test('final quotation comes from registry evidence, not model text', async () => {
  const modelText = 'MODEL-CONTROLLED-QUOTE: different text';
  const result = await serviceFor(supportedOutput(modelText)).ask('Inspect the passage.');

  assert.equal(result.ok, true);
  assert.equal(result.interpretation, modelText);
  assert.equal(
    result.exactQuotation,
    'Truth springeth out of the earth; And righteousness hath looked down from heaven.',
  );
  assert.notEqual(result.exactQuotation, modelText);
});

test('model-supplied quotation, range, hash, metadata, or URL makes output malformed', async () => {
  for (const [key, value] of [
    ['quotation', 'model quote'],
    ['range', { start: 0, end: 1 }],
    ['sha256', '0'.repeat(64)],
    ['versionTitle', 'substituted version'],
    ['sourceUrl', 'https://example.invalid'],
  ]) {
    await assert.rejects(
      serviceFor({ ...supportedOutput(), [key]: value }).ask('Inspect it.'),
      (error) => error instanceof ArielDemoError && error.code === 'MODEL_RESPONSE_MALFORMED',
    );
  }
});

test('unsupported model output is blocked without publishing prose or a quotation', async () => {
  const result = await serviceFor({
    interpretation: 'The corpus does not support this.',
    support_status: 'unsupported',
    citations: [],
  }).ask('What is the weather?');

  assert.equal(result.ok, false);
  assert.equal(result.verification.code, 'UNSUPPORTED_CLAIM');
  assert.equal(Object.hasOwn(result, 'interpretation'), false);
  assert.equal(Object.hasOwn(result, 'exactQuotation'), false);
});

test('transparent post-model quotation tampering remains blocked by exact comparison', async () => {
  const result = await serviceFor(supportedOutput()).ask('Inspect the passage.', {
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
    end: DEMO_MANIFEST[0].start,
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

test('unknown model reference identifier is rejected without releasing a quotation', async () => {
  await assert.rejects(
    serviceFor(supportedOutput('Invented reference.', 'unknown-reference')).ask('Inspect it.'),
    (error) => error instanceof ArielDemoError && error.code === 'MODEL_RESPONSE_MALFORMED',
  );
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

test('runtime status reports both registered sources and both bounded references', () => {
  const status = new ArielService({ modelClient: new FakeModelClient() }).status();

  assert.equal(status.sourceCount, 2);
  assert.equal(status.referenceCount, 2);
});
