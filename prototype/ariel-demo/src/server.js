'use strict';

const { readFile } = require('node:fs/promises');
const { createServer } = require('node:http');
const path = require('node:path');
const { ArielService } = require('./ariel-service');
const { ArielDemoError, asPublicError } = require('./errors');
const { FakeModelClient, OpenAIResponsesClient } = require('./model-clients');
const { DEFAULT_MODEL } = require('./model-contract');

const LOCAL_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const MAX_REQUEST_BYTES = 16 * 1024;
const PUBLIC_DIRECTORY = path.join(__dirname, '..', 'public');
const STATIC_ROUTES = Object.freeze({
  '/': Object.freeze({ file: 'index.html', type: 'text/html; charset=utf-8' }),
  '/app.js': Object.freeze({ file: 'app.js', type: 'text/javascript; charset=utf-8' }),
  '/styles.css': Object.freeze({ file: 'styles.css', type: 'text/css; charset=utf-8' }),
});

function securityHeaders(contentType) {
  return {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; base-uri 'none'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
    'Content-Type': contentType,
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, securityHeaders('application/json; charset=utf-8'));
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    throw new ArielDemoError('INVALID_REQUEST');
  }

  const chunks = [];
  let byteLength = 0;
  for await (const chunk of request) {
    byteLength += chunk.length;
    if (byteLength > MAX_REQUEST_BYTES) {
      throw new ArielDemoError('REQUEST_TOO_LARGE');
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ArielDemoError('INVALID_REQUEST');
  }
}

function parseAskRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ArielDemoError('INVALID_REQUEST');
  }
  const keys = Object.keys(body);
  if (keys.some((key) => !['question', 'simulateTampering'].includes(key))) {
    throw new ArielDemoError('INVALID_REQUEST');
  }
  if (
    body.simulateTampering !== undefined &&
    typeof body.simulateTampering !== 'boolean'
  ) {
    throw new ArielDemoError('INVALID_REQUEST');
  }
  return {
    question: body.question,
    simulateTampering: body.simulateTampering === true,
  };
}

function originAllowed(request) {
  const localPort = request.socket && request.socket.localPort;
  const host = request.headers.host;
  if (!Number.isSafeInteger(localPort) || typeof host !== 'string') {
    return false;
  }

  let authority;
  try {
    authority = new URL(`http://${host}`);
  } catch {
    return false;
  }

  const hostname = authority.hostname.toLowerCase();
  const authorityPort = Number(authority.port || 80);
  if (
    !['127.0.0.1', 'localhost'].includes(hostname) ||
    authorityPort !== localPort ||
    authority.pathname !== '/' ||
    authority.search !== '' ||
    authority.hash !== ''
  ) {
    return false;
  }

  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).origin === authority.origin;
  } catch {
    return false;
  }
}

function createArielServer({ service }) {
  if (!service || typeof service.ask !== 'function' || typeof service.status !== 'function') {
    throw new TypeError('createArielServer requires an ArielService-compatible object.');
  }

  return createServer(async (request, response) => {
    let pathname;
    try {
      pathname = new URL(request.url, 'http://local.invalid').pathname;
    } catch {
      writeJson(response, 400, { ok: false, error: new ArielDemoError('INVALID_REQUEST').toPublicJSON() });
      return;
    }

    try {
      if (request.method === 'GET' && pathname === '/api/status') {
        writeJson(response, 200, { ok: true, ...service.status() });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/ask') {
        if (!originAllowed(request)) {
          throw new ArielDemoError('INVALID_REQUEST');
        }
        const askRequest = parseAskRequest(await readJsonBody(request));
        const result = await service.ask(askRequest.question, {
          simulateTampering: askRequest.simulateTampering,
        });
        writeJson(response, 200, result);
        return;
      }

      const staticRoute = request.method === 'GET' && STATIC_ROUTES[pathname];
      if (staticRoute) {
        const contents = await readFile(path.join(PUBLIC_DIRECTORY, staticRoute.file));
        response.writeHead(200, securityHeaders(staticRoute.type));
        response.end(contents);
        return;
      }

      writeJson(response, 404, {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Route not found.' },
      });
    } catch (error) {
      const publicError = asPublicError(error);
      writeJson(response, publicError.httpStatus, {
        ok: false,
        outcome: 'error',
        error: publicError.toPublicJSON(),
      });
    }
  });
}

function readRuntimeConfig(environment = process.env) {
  const provider = environment.ARIEL_MODEL_PROVIDER || 'fake';
  if (!['fake', 'openai'].includes(provider)) {
    throw new ArielDemoError('INVALID_RUNTIME_CONFIG');
  }

  const rawPort = environment.ARIEL_PORT || String(DEFAULT_PORT);
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new ArielDemoError('INVALID_RUNTIME_CONFIG');
  }

  return Object.freeze({
    provider,
    port,
    model: environment.OPENAI_MODEL || DEFAULT_MODEL,
    apiKey: environment.OPENAI_API_KEY,
  });
}

function createRuntimeService({ environment = process.env, fetchImpl = globalThis.fetch } = {}) {
  const privateConfig = readRuntimeConfig(environment);
  const modelClient = privateConfig.provider === 'openai'
    ? new OpenAIResponsesClient({
      apiKey: privateConfig.apiKey,
      model: privateConfig.model,
      fetchImpl,
    })
    : new FakeModelClient();

  return Object.freeze({
    config: Object.freeze({
      provider: privateConfig.provider,
      port: privateConfig.port,
      model: privateConfig.model,
    }),
    service: new ArielService({ modelClient }),
  });
}

function listen(server, { port, host = LOCAL_HOST }) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve(server.address());
    });
  });
}

async function startFromEnvironment() {
  const runtime = createRuntimeService();
  const server = createArielServer({ service: runtime.service });
  await listen(server, { port: runtime.config.port });
  console.log(`[ariel] local=${`http://${LOCAL_HOST}:${runtime.config.port}`} provider=${runtime.config.provider} model=${runtime.service.status().model}`);
  return server;
}

if (require.main === module) {
  startFromEnvironment().catch((error) => {
    const publicError = asPublicError(error);
    console.error(`[ariel] startup failed code=${publicError.code}`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  DEFAULT_PORT,
  LOCAL_HOST,
  MAX_REQUEST_BYTES,
  createArielServer,
  createRuntimeService,
  listen,
  originAllowed,
  parseAskRequest,
  readJsonBody,
  readRuntimeConfig,
  startFromEnvironment,
});
