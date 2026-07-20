'use strict';

const form = document.querySelector('#ask-form');
const question = document.querySelector('#question');
const simulateTampering = document.querySelector('#simulate-tampering');
const askButton = document.querySelector('#ask-button');
const runtimeBadge = document.querySelector('#runtime-badge');
const resultCard = document.querySelector('#result-card');
const verificationPill = document.querySelector('#verification-pill');
const interpretation = document.querySelector('#interpretation');
const modelMeta = document.querySelector('#model-meta');
const exactQuotation = document.querySelector('#exact-quotation');
const sourceReference = document.querySelector('#source-reference');
const integrityResult = document.querySelector('#integrity-result');
const gateMessage = document.querySelector('#gate-message');

function setRuntime(status) {
  const configured = status.provider === 'openai'
    ? status.liveConfigured ? 'configured' : 'key missing'
    : 'offline';
  runtimeBadge.textContent = `${status.provider} · ${status.model} · ${configured}`;
}

function formatReference(reference) {
  if (!reference) {
    return 'No reference released';
  }
  const range = reference.range;
  return `${reference.sourceId}@${reference.sourceVersion} · ${reference.referenceId} · [${range.start}, ${range.end}) ${range.offsetUnit}`;
}

function renderResult(result) {
  resultCard.hidden = false;
  const state = result.ok ? 'verified' : result.outcome === 'blocked' ? 'blocked' : 'error';
  resultCard.dataset.state = state;
  verificationPill.textContent = state === 'verified' ? 'Verified' : state === 'blocked' ? 'Blocked' : 'Error';

  if (result.model) {
    modelMeta.textContent = `${result.model.provider} · ${result.model.model}`;
  } else {
    modelMeta.textContent = 'No model output accepted';
  }

  if (result.ok) {
    interpretation.textContent = result.interpretation;
    exactQuotation.textContent = result.exactQuotation;
    sourceReference.textContent = formatReference(result.sourceReference);
    integrityResult.textContent = `${result.verification.integrity.hashAlgorithm} PASS · ${result.verification.integrity.contentHash}`;
    gateMessage.textContent = `${result.provenance} ${result.limitation}`;
  } else if (result.outcome === 'blocked') {
    interpretation.textContent = 'Withheld because the deterministic Claim Gate did not accept the declared support.';
    exactQuotation.textContent = 'No quotation released';
    sourceReference.textContent = formatReference(result.sourceReference);
    const cause = result.verification.causeCode ? ` · cause ${result.verification.causeCode}` : '';
    integrityResult.textContent = `${result.verification.code}${cause}`;
    gateMessage.textContent = result.verification.simulatedTampering
      ? 'Transparent simulation: the application altered citation evidence after model generation. Claim Gate detected the mismatch and blocked it; the model did not perform the attack.'
      : result.message;
  } else {
    interpretation.textContent = 'No model interpretation was accepted.';
    exactQuotation.textContent = 'No quotation released';
    sourceReference.textContent = 'No reference released';
    integrityResult.textContent = result.error ? result.error.code : 'UNKNOWN_ERROR';
    gateMessage.textContent = result.error ? result.error.message : 'The request failed closed.';
  }

  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function loadRuntimeStatus() {
  try {
    const response = await fetch('/api/status', { headers: { Accept: 'application/json' } });
    const status = await response.json();
    if (!response.ok || !status.ok) {
      throw new Error('status unavailable');
    }
    setRuntime(status);
  } catch {
    runtimeBadge.textContent = 'Local runtime unavailable';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  askButton.disabled = true;
  askButton.firstElementChild.textContent = 'Checking…';
  form.setAttribute('aria-busy', 'true');

  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: question.value,
        simulateTampering: simulateTampering.checked,
      }),
    });
    const result = await response.json();
    renderResult(result);
  } catch {
    renderResult({
      ok: false,
      outcome: 'error',
      error: {
        code: 'LOCAL_REQUEST_FAILED',
        message: 'The local server could not complete the request.',
      },
    });
  } finally {
    askButton.disabled = false;
    askButton.firstElementChild.textContent = 'Ask Ariel';
    form.removeAttribute('aria-busy');
  }
});

loadRuntimeStatus();
