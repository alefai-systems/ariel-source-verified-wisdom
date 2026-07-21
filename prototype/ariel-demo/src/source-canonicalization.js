'use strict';

const NAMED_ENTITIES = Object.freeze({
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: '\u00a0',
  quot: '"',
});

function decodeNumericEntity(entity) {
  const hexadecimal = entity[1].toLowerCase() === 'x';
  const digits = hexadecimal ? entity.slice(2) : entity.slice(1);
  const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
  if (
    !Number.isSafeInteger(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    throw new TypeError('Source text contains an invalid numeric HTML entity.');
  }
  return String.fromCodePoint(codePoint);
}

function decodeHtmlEntities(text) {
  const decoded = text.replace(
    /&(#(?:x[0-9a-f]+|[0-9]+)|amp|apos|gt|lt|nbsp|quot);/giu,
    (_match, entity) => entity.startsWith('#')
      ? decodeNumericEntity(entity)
      : NAMED_ENTITIES[entity.toLowerCase()],
  );

  if (/&(?:#[^;\s]*|[a-z][a-z0-9]+);/iu.test(decoded)) {
    throw new TypeError('Source text contains an unsupported HTML entity.');
  }
  return decoded;
}

function canonicalizeSefariaText(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Sefaria source text must be a string.');
  }

  return decodeHtmlEntities(value)
    .replace(/<br\b[^>]*>/giu, ' ')
    .replace(/\r\n|\r|\n/gu, ' ')
    .replace(/<[^>]*>/gu, '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ');
}

module.exports = Object.freeze({
  canonicalizeSefariaText,
  decodeHtmlEntities,
});
