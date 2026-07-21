'use strict';

const { ArielDemoError, asPublicError } = require('../src/errors');
const { createRuntimeService } = require('../src/server');

function formatFailure(error) {
  const publicError = asPublicError(error);
  const reason = publicError.code === 'MODEL_INCOMPLETE'
    ? ` reason=${JSON.stringify(publicError.details.reason)}`
    : '';
  return `[live-smoke] failed code=${publicError.code}${reason}`;
}

async function main() {
  if (typeof process.env.OPENAI_API_KEY !== 'string' || process.env.OPENAI_API_KEY.trim().length === 0) {
    console.error('[live-smoke] skipped: OPENAI_API_KEY is not set');
    process.exitCode = 2;
    return;
  }

  const environment = {
    ...process.env,
    ARIEL_MODEL_PROVIDER: 'openai',
  };
  const runtime = createRuntimeService({ environment });
  const result = await runtime.service.ask(
    'What does it mean for truth to spring from the earth?',
  );

  if (!result.model || result.model.responseStatus !== 'completed') {
    throw new ArielDemoError('MODEL_STATUS_NOT_COMPLETED');
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(formatFailure(error));
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  formatFailure,
  main,
});
