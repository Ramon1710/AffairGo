const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { filterNearbyDates } = require('../untils/dateLocation');

test('Dates im Radius bleiben sichtbar, außerhalb des Radius nicht', () => {
  const nowMs = Date.now();
  const currentUser = { latitude: 50.9375, longitude: 6.9603, city: 'Köln' };
  const dates = [
    {
      id: 'nearby',
      status: 'active',
      scheduledAtMs: nowMs + (2 * 60 * 60 * 1000),
      coordinate: { latitude: 50.938, longitude: 6.97 },
    },
    {
      id: 'far-away',
      status: 'active',
      scheduledAtMs: nowMs + (3 * 60 * 60 * 1000),
      coordinate: { latitude: 53.5511, longitude: 9.9937 },
    },
  ];

  const visibleDates = filterNearbyDates(dates, { currentUser, radiusKm: 25, nowMs });

  assert.deepEqual(visibleDates.map((entry) => entry.id), ['nearby']);
});

test('Vergangene und abgesagte Dates werden im Feed ausgeblendet', () => {
  const nowMs = Date.now();
  const currentUser = { latitude: 50.9375, longitude: 6.9603, city: 'Köln' };
  const dates = [
    {
      id: 'cancelled',
      status: 'cancelled',
      scheduledAtMs: nowMs + (2 * 60 * 60 * 1000),
      coordinate: { latitude: 50.938, longitude: 6.97 },
    },
    {
      id: 'past',
      status: 'active',
      scheduledAtMs: nowMs - (2 * 60 * 60 * 1000),
      coordinate: { latitude: 50.938, longitude: 6.97 },
    },
    {
      id: 'future',
      status: 'active',
      scheduledAtMs: nowMs + (4 * 60 * 60 * 1000),
      coordinate: { latitude: 50.938, longitude: 6.97 },
    },
  ];

  const visibleDates = filterNearbyDates(dates, { currentUser, radiusKm: 25, nowMs });

  assert.deepEqual(visibleDates.map((entry) => entry.id), ['future']);
});

test('ExploreScreen hält den Erstellen-Button auch bei Fehler und Leerzustand sichtbar', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/ExploreScreen.js', 'utf8');

  assert.match(source, /label="\+ Date erstellen"/);
  assert.match(source, /title="Dates konnten nicht geladen werden"/);
  assert.match(source, /label="Erstes Date erstellen"/);
  assert.match(source, /title="Dates aktuell nicht freigeschaltet"/);
});