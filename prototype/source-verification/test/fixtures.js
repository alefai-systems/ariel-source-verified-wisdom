'use strict';

const HEBREW_TEXT = 'מקור א: ״עֵץ 42?״ (בדיקה) \u200fRTL';

const SOURCES = Object.freeze({
  hebrew: Object.freeze({
    sourceId: 'synthetic-hebrew-rtl',
    sourceVersion: 'v1',
    canonicalText: HEBREW_TEXT,
  }),
  whitespace: Object.freeze({
    sourceId: 'whitespace',
    sourceVersion: 'v1',
    canonicalText: '  exact text  ',
  }),
  crlf: Object.freeze({
    sourceId: 'crlf',
    sourceVersion: 'v1',
    canonicalText: 'first\r\nsecond',
  }),
  combining: Object.freeze({
    sourceId: 'combining',
    sourceVersion: 'v1',
    canonicalText: 'Cafe\u0301',
  }),
  precomposed: Object.freeze({
    sourceId: 'precomposed',
    sourceVersion: 'v1',
    canonicalText: 'Café',
  }),
  ascii: Object.freeze({
    sourceId: 'ascii',
    sourceVersion: '0',
    canonicalText: 'Tree A cites sources.',
  }),
});

module.exports = Object.freeze({ HEBREW_TEXT, SOURCES });
