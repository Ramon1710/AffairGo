import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { formatRadiusKm, getAllowedRadiusOptions, getDefaultRadiusKm, normalizeRadiusKm } from '../untils/radius.js';

test('gespeicherte Radiuswerte bleiben erhalten und werden nicht auf 25 km zurueckgesetzt', () => {
  assert.equal(normalizeRadiusKm(50), 50);
  assert.equal(normalizeRadiusKm(100), 100);
  assert.equal(normalizeRadiusKm(25), 25);
});

test('Standardwert wird nur bei wirklich fehlendem oder ungueltigem Radius verwendet', () => {
  const defaultRadius = getDefaultRadiusKm();

  assert.equal(normalizeRadiusKm(undefined), defaultRadius);
  assert.equal(normalizeRadiusKm(null), defaultRadius);
  assert.equal(normalizeRadiusKm('ungueltig'), defaultRadius);
});

test('ungueltige Radiuswerte werden sicher auf erlaubte Optionen normalisiert', () => {
  assert.equal(normalizeRadiusKm(21), 25);
  assert.equal(normalizeRadiusKm(151), 150);
  assert.equal(normalizeRadiusKm(5), 5);
  assert.equal(normalizeRadiusKm(150), 150);
});

test('Dashboard und Matching Map verwenden dieselbe Radius-Formatierung', () => {
  assert.equal(formatRadiusKm(50), '50 km');
  assert.equal(formatRadiusKm(25), '25 km');
  assert.deepEqual(getAllowedRadiusOptions(), [5, 10, 20, 25, 50, 100, 150]);
});

test('Dashboard liest den zentralen currentRadius und nicht ein lokales Fallback-Feld', () => {
  const dashboardSource = readFileSync('/workspaces/AffairGo/screens/Dashboard.js', 'utf8');

  assert.match(dashboardSource, /currentRadius/u);
  assert.match(dashboardSource, /formatRadiusKm\(currentRadius\)/u);
  assert.equal(dashboardSource.includes('${currentUser.radius} km'), false);
});

test('Matching Map und Context nutzen dieselbe zentrale Radiusquelle', () => {
  const mapSource = readFileSync('/workspaces/AffairGo/screens/MatchingMapScreen.js', 'utf8');
  const contextSource = readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');

  assert.match(mapSource, /radiusKm=\{currentRadius\}/u);
  assert.match(mapSource, /setCurrentRadius\(radius\)/u);
  assert.match(contextSource, /setCurrentUser\(\(previous\) => \(\{ \.\.\.previous, radius: nextRadius \}\)\)/u);
  assert.match(contextSource, /persistCurrentUserPatch\(\{ radius: nextRadius \}\)/u);
  assert.match(contextSource, /setCurrentRadiusState\(normalizedProfile\.radius\)/u);
});

test('fehlgeschlagene Radius-Persistenz erzeugt eine sichtbare Fehlermeldung und keinen stillen Dauerzustand', () => {
  const mapSource = readFileSync('/workspaces/AffairGo/screens/MatchingMapScreen.js', 'utf8');
  const contextSource = readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');

  assert.match(contextSource, /savedToFirestore/u);
  assert.match(contextSource, /Der neue Suchradius konnte nicht gespeichert werden\. Bitte versuche es erneut\./u);
  assert.match(mapSource, /Radius noch nicht gespeichert/u);
});