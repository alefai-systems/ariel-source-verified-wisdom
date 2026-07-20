'use strict';

const { asPublicError } = require('../src/errors');
const { createRuntimeService } = require('../src/server');

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
    'What appears in the quoted segment of the synthetic Hebrew fixture?',
  );

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const publicError = asPublicError(error);
  console.error(`[live-smoke] failed code=${publicError.code}`);
  process.exitCode = 1;
});
