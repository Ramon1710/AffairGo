import assert from 'node:assert/strict';
import test from 'node:test';
import { mapDateErrorMessage } from '../constants/dateProvider.js';

test('Date-Provider mappt den bisherigen internal-Fehler auf eine verständliche Backend-Meldung', () => {
  const message = mapDateErrorMessage({ code: 'functions/internal', message: 'internal' }, 'listDates');
  assert.equal(message, 'Das Dates-Backend ist derzeit nicht erreichbar. Bitte versuche es später erneut.');
});

test('Date-Provider lässt fachliche Firebase-Fehlertexte für permission-denied durch', () => {
  const message = mapDateErrorMessage({ code: 'functions/permission-denied', message: 'Für Dates muss deine E-Mail bestätigt sein.' }, 'createDate');
  assert.equal(message, 'Für Dates muss deine E-Mail bestätigt sein.');
});