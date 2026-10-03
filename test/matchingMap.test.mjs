import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildRadarProfiles, buildSwipeDeckProfiles, filterMatchingMapProfiles } from '../untils/matchingMap.js';

const createProfile = (overrides = {}) => ({
  id: overrides.id || `profile-${Math.random().toString(36).slice(2, 8)}`,
  verified: true,
  online: true,
  profilePhotoAgeMonths: 0,
  ...overrides,
});

test('Profil mit neuem Bild bleibt in der Matching Map sichtbar', () => {
  const profiles = [createProfile({ id: 'fresh', profilePhotoAgeMonths: 0 })];

  const result = filterMatchingMapProfiles(profiles, { verifiedOnly: false });

  assert.deepEqual(result.map((profile) => profile.id), ['fresh']);
});

test('Profil mit altem Bild bleibt bei erfuellten Bedingungen ebenfalls sichtbar', () => {
  const profiles = [createProfile({ id: 'old', profilePhotoAgeMonths: 24 })];

  const result = filterMatchingMapProfiles(profiles, { verifiedOnly: false });

  assert.deepEqual(result.map((profile) => profile.id), ['old']);
});

test('gespeicherter alter Fotoalter-Filter wird ignoriert', () => {
  const profiles = [
    createProfile({ id: 'fresh', profilePhotoAgeMonths: 1 }),
    createProfile({ id: 'old', profilePhotoAgeMonths: 18 }),
  ];

  const result = filterMatchingMapProfiles(profiles, {
    verifiedOnly: false,
    photoAgeFilter: 12,
  });

  assert.deepEqual(result.map((profile) => profile.id), ['fresh', 'old']);
});

test('Map-, Listen- und Radaransicht bauen auf derselben Basisfilterung auf', () => {
  const profiles = [
    createProfile({ id: 'verified-online', verified: true, online: true }),
    createProfile({ id: 'verified-offline', verified: true, online: false }),
    createProfile({ id: 'unverified-online', verified: false, online: true }),
  ];

  const filteredProfiles = filterMatchingMapProfiles(profiles, { verifiedOnly: true, photoAgeFilter: 99 });
  const radarProfiles = buildRadarProfiles(filteredProfiles);

  assert.deepEqual(filteredProfiles.map((profile) => profile.id), ['verified-online', 'verified-offline']);
  assert.deepEqual(radarProfiles.map((profile) => profile.id), ['verified-online']);
});

test('Dismiss durch A entfernt B nur aus dem Swipe-Deck von A', () => {
  const profiles = [
    createProfile({ id: 'b' }),
    createProfile({ id: 'c' }),
  ];

  const mapProfiles = filterMatchingMapProfiles(profiles, { verifiedOnly: false });
  const swipeProfiles = buildSwipeDeckProfiles(profiles, ['b']);

  assert.deepEqual(mapProfiles.map((profile) => profile.id), ['b', 'c']);
  assert.deepEqual(swipeProfiles.map((profile) => profile.id), ['c']);
});

test('Logout markiert die Presence im Context explizit als offline und unsichtbar', () => {
  const contextSource = readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');

  assert.match(contextSource, /setCurrentUserPresenceState\(\{ online: false, visible: false \}\);/);
});

test('Matching-Map-UI enthaelt keine Fotoalter-Auswahl mehr', () => {
  const screenSource = readFileSync('/workspaces/AffairGo/screens/MatchingMapScreen.js', 'utf8');

  assert.equal(screenSource.includes('PHOTO_AGE_FILTERS'), false);
  assert.equal(screenSource.includes('photoAgeFilter'), false);
  assert.equal(screenSource.includes('Foto >'), false);
  assert.equal(screenSource.includes('Monate alt'), false);
});

test('Matching-Map nutzt einen diskreten Radiusregler auf Basis der bestehenden Radiusoptionen', () => {
  const screenSource = readFileSync('/workspaces/AffairGo/screens/MatchingMapScreen.js', 'utf8');

  assert.match(screenSource, /const radiusOptions = useMemo\(\(\) => getAllowedRadiusOptions\(\), \[]\);/);
  assert.match(screenSource, /const \[pendingRadius, setPendingRadius\] = useState\(currentRadius\);/);
  assert.match(screenSource, /commitRadiusSelection/);
  assert.match(screenSource, /PanResponder\.create/);
  assert.match(screenSource, /accessibilityRole="adjustable"/);
  assert.match(screenSource, /radiusKm=\{displayRadius\}/);
  assert.match(screenSource, /await setCurrentRadius\(normalizedRadius\);/);
});

test('Matching-Map speichert den zentralen Radius erst beim Loslassen oder gezielten Auswählen', () => {
  const screenSource = readFileSync('/workspaces/AffairGo/screens/MatchingMapScreen.js', 'utf8');

  assert.match(screenSource, /onPanResponderRelease: \(\) => \{/);
  assert.match(screenSource, /commitRadiusSelection\(pendingRadiusRef\.current\);/);
  assert.match(screenSource, /onPress=\{\(event\) => handleRadiusTrackPress\(event\.nativeEvent\.locationX\)\}/);
  assert.equal(screenSource.includes('ToggleChip label={formatRadiusKm(radius)} active={currentRadius === radius} onPress={() => setCurrentRadius(radius)}'), false);
});