'use strict';

const ERROR_DEFINITIONS = Object.freeze({
  INVALID_QUESTION: Object.freeze({
    status: 400,
    message: 'Enter a question between 1 and 1,000 characters.',
  }),
  INVALID_REQUEST: Object.freeze({
    status: 400,
    message: 'The request must be a supported JSON object.',
  }),
  REQUEST_TOO_LARGE: Object.freeze({
    status: 413,
    message: 'The request body exceeds the local demo limit.',
  }),
  MODEL_CONFIG_MISSING: Object.freeze({
    status: 503,
    message: 'Live OpenAI mode requires OPENAI_API_KEY on the server.',
  }),
  MODEL_TIMEOUT: Object.freeze({
    status: 504,
    message: 'The model request timed out and no answer was accepted.',
  }),
  MODEL_HTTP_ERROR: Object.freeze({
    status: 502,
    message: 'The model service returned an error and no answer was accepted.',
  }),
  MODEL_UNAVAILABLE: Object.freeze({
    status: 502,
    message: 'The model service was unavailable and no answer was accepted.',
  }),
  MODEL_REFUSAL: Object.freeze({
    status: 422,
    message: 'The model refused the request and no answer was accepted.',
  }),
  MODEL_INCOMPLETE: Object.freeze({
    status: 502,
    message: 'The model response was incomplete and no answer was accepted.',
  }),
  MODEL_RESPONSE_MALFORMED: Object.freeze({
    status: 502,
    message: 'The model response did not match the required structure.',
  }),
  INVALID_RUNTIME_CONFIG: Object.freeze({
    status: 500,
    message: 'The local demo runtime configuration is invalid.',
  }),
});

class ArielDemoError extends Error {
  constructor(code) {
    const definition = ERROR_DEFINITIONS[code];
    if (!definition) {
      throw new TypeError(`Unknown Ariel demo error code: ${code}`);
    }

    super(definition.message);
    this.name = 'ArielDemoError';
    this.code = code;
    this.httpStatus = definition.status;
  }

  toPublicJSON() {
    return Object.freeze({
      code: this.code,
      message: this.message,
    });
  }
}

function asPublicError(error) {
  if (error instanceof ArielDemoError) {
    return error;
  }
  return new ArielDemoError('MODEL_UNAVAILABLE');
}

module.exports = Object.freeze({
  ArielDemoError,
  ERROR_DEFINITIONS,
  asPublicError,
});
