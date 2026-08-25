import assert from 'node:assert/strict';
import test from 'node:test';

import { getMatchEligibility } from '../untils/matching.js';

const nowIso = () => new Date().toISOString();
const staleIso = () => new Date(Date.now() - (11 * 60 * 1000)).toISOString();

const createProfile = (overrides = {}) => ({
  id: overrides.id || `profile-${Math.random().toString(36).slice(2, 8)}`,
  age: 30,
  searchAgeMin: 25,
  searchAgeMax: 40,
  radius: 50,
  distanceKm: 20,
  gender: 'weiblich',
  searchGenders: ['männlich', 'weiblich', 'divers', 'paare'],
  preferences: ['Zungenküsse', 'Vorspiel genießen', 'Sex mit Musik'],
  taboos: ['Kein BDSM'],
  dismissedProfileIds: [],
  searchActive: true,
  online: true,
  lastLiveSyncAt: nowIso(),
  profilePhotoUrl: 'https://example.com/profile.jpg',
  profileImageUri: 'https://example.com/profile.jpg',
  moderationState: 'clear',
  accountDeletionRequestedAt: '',
  isAdmin: false,
  role: 'member',
  ...overrides,
});

test('genau drei gemeinsame Vorlieben sind zulässig', () => {
  const profileA = createProfile({ id: 'a', age: 30, searchAgeMin: 27, searchAgeMax: 35, gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({
    id: 'b',
    age: 35,
    searchAgeMin: 30,
    searchAgeMax: 40,
    preferences: ['Zungenküsse', 'Vorspiel genießen', 'Sex mit Musik', 'Dirty Talk'],
  });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.commonPreferenceCount, 3);
  assert.equal(result.ageCompatible, true);
  assert.equal(result.hasMinimumSharedPreferences, true);
  assert.equal(result.isEligible, true);
});

test('mehr als drei gemeinsame Vorlieben sind zulässig', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'], preferences: ['Zungenküsse', 'Vorspiel genießen', 'Sex mit Musik', 'Dirty Talk'] });
  const profileB = createProfile({ id: 'b', age: 31, searchAgeMin: 28, searchAgeMax: 38, preferences: ['Zungenküsse', 'Vorspiel genießen', 'Sex mit Musik', 'Dirty Talk', 'Rollenspiele'] });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.commonPreferenceCount, 4);
  assert.equal(result.isEligible, true);
});

test('nur zwei gemeinsame Vorlieben sind nicht zulässig', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', preferences: ['Zungenküsse', 'Vorspiel genießen', 'Dirty Talk'] });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.commonPreferenceCount, 2);
  assert.equal(result.isEligible, false);
  assert.ok(result.reasons.includes('insufficient_common_preferences'));
});

test('Alter genau an der unteren Grenze ist zulässig', () => {
  const profileA = createProfile({ id: 'a', age: 25, searchAgeMin: 25, searchAgeMax: 35, gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', age: 35, searchAgeMin: 25, searchAgeMax: 35 });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.sourceAgeInTargetRange, true);
  assert.equal(result.targetAgeInSourceRange, true);
  assert.equal(result.isEligible, true);
});

test('Alter genau an der oberen Grenze ist zulässig', () => {
  const profileA = createProfile({ id: 'a', age: 40, searchAgeMin: 30, searchAgeMax: 40, gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', age: 30, searchAgeMin: 25, searchAgeMax: 40 });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.sourceAgeInTargetRange, true);
  assert.equal(result.targetAgeInSourceRange, true);
  assert.equal(result.isEligible, true);
});

test('Nutzer A außerhalb der Range von Nutzer B ist nicht zulässig', () => {
  const profileA = createProfile({ id: 'a', age: 24, gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', searchAgeMin: 25, searchAgeMax: 40 });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.sourceAgeInTargetRange, false);
  assert.equal(result.isEligible, false);
  assert.ok(result.reasons.includes('source_age_out_of_target_range'));
});

test('Nutzer B außerhalb der Range von Nutzer A ist nicht zulässig', () => {
  const profileA = createProfile({ id: 'a', searchAgeMin: 25, searchAgeMax: 35, gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', age: 36 });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.targetAgeInSourceRange, false);
  assert.equal(result.isEligible, false);
  assert.ok(result.reasons.includes('target_age_out_of_source_range'));
});

test('Profil innerhalb des Radius ist zulässig', () => {
  const profileA = createProfile({ id: 'a', radius: 50, gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', distanceKm: 49 });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.withinCurrentUserRadius, true);
  assert.equal(result.isEligible, true);
});

test('Profil genau auf der Radiusgrenze ist zulässig', () => {
  const profileA = createProfile({ id: 'a', radius: 50, gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', distanceKm: 50 });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.withinCurrentUserRadius, true);
  assert.equal(result.isEligible, true);
});

test('Profil außerhalb des Radius ist nicht zulässig', () => {
  const profileA = createProfile({ id: 'a', radius: 50, gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', distanceKm: 51 });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.withinCurrentUserRadius, false);
  assert.equal(result.isEligible, false);
  assert.ok(result.reasons.includes('outside_current_user_radius'));
});

test('Radiuserhöhung von 50 auf 100 km macht ein zuvor ausgeschlossenes Profil sichtbar', () => {
  const source50 = createProfile({ id: 'a', radius: 50, gender: 'männlich', searchGenders: ['weiblich'] });
  const source100 = createProfile({ id: 'a', radius: 100, gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', distanceKm: 75 });

  const before = getMatchEligibility(source50, profileB);
  const after = getMatchEligibility(source100, profileB);

  assert.equal(before.isEligible, false);
  assert.equal(after.isEligible, true);
});

test('Radius des anderen Nutzers beeinflusst das Ergebnis nicht', () => {
  const profileA = createProfile({ id: 'a', radius: 50, gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', radius: 1, distanceKm: 30 });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.withinCurrentUserRadius, true);
  assert.equal(result.isEligible, true);
});

test('blockierter Nutzer ist trotz passender Kriterien ausgeschlossen', () => {
  const profileA = createProfile({ id: 'a', dismissedProfileIds: ['b'], gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b' });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.isBlocked, true);
  assert.equal(result.isEligible, false);
  assert.ok(result.reasons.includes('blocked_profile'));
});

test('Gegenblockierung durch den anderen Nutzer schließt ebenfalls aus', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', dismissedProfileIds: ['a'] });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.isBlocked, true);
  assert.equal(result.isEligible, false);
});

test('doppelte Vorlieben werden nicht doppelt gezählt', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'], preferences: ['Zungenküsse', 'Zungenküsse', 'Vorspiel genießen', 'Sex mit Musik'] });
  const profileB = createProfile({ id: 'b', preferences: ['Zungenküsse', 'Vorspiel genießen', 'Sex mit Musik', 'Sex mit Musik'] });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.commonPreferenceCount, 3);
  assert.deepEqual(result.commonPreferences, ['Zungenküsse', 'Vorspiel genießen', 'Sex mit Musik']);
});

test('Tabus werden nicht als Vorlieben gezählt', () => {
  const profileA = createProfile({
    id: 'a',
    gender: 'männlich',
    searchGenders: ['weiblich'],
    preferences: ['Zungenküsse', 'Vorspiel genießen', 'Sex mit Musik'],
    taboos: ['Kein Dirty Talk', 'Kein BDSM'],
  });
  const profileB = createProfile({
    id: 'b',
    preferences: ['Zungenküsse', 'Vorspiel genießen', 'Dirty Talk'],
    taboos: ['Kein Oralsex geben'],
  });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.commonPreferenceCount, 2);
  assert.deepEqual(result.commonPreferences, ['Zungenküsse', 'Vorspiel genießen']);
  assert.equal(result.isEligible, false);
});

test('Profilgeschlecht entsprechend der Suche des aktuellen Nutzers ist zulässig', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich', 'divers'] });
  const profileB = createProfile({ id: 'b', gender: 'weiblich' });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.genderMatchesCurrentUserSearch, true);
  assert.equal(result.isEligible, true);
});

test('Profilgeschlecht außerhalb der Suche des aktuellen Nutzers ist ausgeschlossen', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['divers'] });
  const profileB = createProfile({ id: 'b', gender: 'weiblich' });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.genderMatchesCurrentUserSearch, false);
  assert.equal(result.isEligible, false);
  assert.ok(result.reasons.includes('gender_not_in_current_user_search'));
});

test('Geschlechtssuche des anderen Nutzers beeinflusst das Ergebnis nicht', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', gender: 'weiblich', searchGenders: ['divers'] });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.isEligible, true);
});

test('Mehrfachauswahl bei gesuchten Geschlechtern funktioniert', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['divers', 'paare'] });
  const profileB = createProfile({ id: 'b', gender: 'paare' });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.genderMatchesCurrentUserSearch, true);
  assert.equal(result.isEligible, true);
});

test('Profilbild vorhanden erfüllt die Bedingung', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', profilePhotoUrl: '', profileImageUri: 'https://example.com/alt.jpg' });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.hasProfilePhoto, true);
  assert.equal(result.isEligible, true);
});

test('fehlendes Profilbild schließt aus', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', profilePhotoUrl: '', profileImageUri: '' });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.hasProfilePhoto, false);
  assert.equal(result.isEligible, false);
  assert.ok(result.reasons.includes('missing_profile_photo'));
});

test('altes Profilbild wird nicht deshalb ausgeschlossen', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', profilePhotoAgeMonths: 36 });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.hasProfilePhoto, true);
  assert.equal(result.isEligible, true);
});

test('Fakecheck- oder Verifizierungsstatus sind kein Kriterium', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', verified: false, verificationState: 'review' });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.isEligible, true);
});

test('online und sichtbar ist zulässig', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', online: true, searchActive: true, lastLiveSyncAt: nowIso() });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.isOnline, true);
  assert.equal(result.isVisible, true);
  assert.equal(result.isEligible, true);
});

test('offline schließt aus', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', online: false });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.isOnline, false);
  assert.equal(result.isEligible, false);
});

test('abgelaufener lastSeen beziehungsweise Heartbeat schließt aus', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', online: true, lastLiveSyncAt: staleIso() });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.isOnline, false);
  assert.equal(result.isEligible, false);
});

test('deaktiviertes searchActive schließt aus, wenn es die manuelle Freigabe ist', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', searchActive: false });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.isVisible, false);
  assert.equal(result.isEligible, false);
  assert.ok(result.reasons.includes('invisible_profile'));
});

test('eigenes Profil ist ausgeschlossen', () => {
  const profileA = createProfile({ id: 'same', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'same' });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.isEligible, false);
  assert.ok(result.reasons.includes('own_profile'));
});

test('zur Löschung vorgemerktes Profil ist ausgeschlossen', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', accountDeletionRequestedAt: nowIso() });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.isEligible, false);
  assert.ok(result.reasons.includes('account_unavailable'));
});

test('moderationsgesperrtes Profil ist ausgeschlossen', () => {
  const profileA = createProfile({ id: 'a', gender: 'männlich', searchGenders: ['weiblich'] });
  const profileB = createProfile({ id: 'b', moderationState: 'restricted' });

  const result = getMatchEligibility(profileA, profileB);

  assert.equal(result.isEligible, false);
  assert.ok(result.reasons.includes('restricted_profile'));
});