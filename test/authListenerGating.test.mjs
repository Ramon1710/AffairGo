import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const contextSource = readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');
const rulesSource = readFileSync('/workspaces/AffairGo/firestore.rules', 'utf8');

test('geschützte Bootstrap-Listener starten erst nach vollständig bereitem Auth-Zustand', () => {
  const guardCount = (contextSource.match(/if \(!isAuthReady \|\| !isAuthenticated\) \{\s*return undefined;/gu) || []).length;

  assert.equal(guardCount, 3, 'users-, featureIdeas- und events-Bootstrap sind jeweils abgesichert');
});

test('die users-Realtime-Abfrage wird bei Auth-Änderungen neu aufgebaut', () => {
  assert.match(contextSource, /unsubscribeUsers\(\);\s*\};\s*\}, \[currentUser\.id, isAuthReady, isAuthenticated\]\);/u);
});

test('featureIdeas- und events-Bootstrap hängen am Auth-Zustand', () => {
  const authGatedDeps = (contextSource.match(/\}, \[isAuthReady, isAuthenticated\]\);/gu) || []).length;

  assert.ok(authGatedDeps >= 2, 'featureIdeas und events reagieren auf den Auth-Zustand');
});

test('firestore.rules verwendet kein ungültiges .exists() auf einem get()-Ergebnis', () => {
  assert.equal(/\)\.exists\(\)/u.test(rulesSource), false, 'get(...).exists() existiert in Firestore Rules nicht');
});

test('firestore.rules prüft Profil-, Regel- und Akzeptanzexistenz über die exists(path)-Funktion', () => {
  assert.match(rulesSource, /exists\(\/databases\/\$\(database\)\/documents\/users\/\$\(request\.auth\.uid\)\)/u);
  assert.match(rulesSource, /exists\(\/databases\/\$\(database\)\/documents\/communityConfig\/rules\)/u);
  assert.match(rulesSource, /exists\(\/databases\/\$\(database\)\/documents\/communityRuleAcceptances\/\$\(request\.auth\.uid\)\)/u);
});

test('firestore.rules enthält keine pauschale Freigabe für Community-Collections', () => {
  assert.equal(/match \/communityRooms\/\{roomId\} \{\s*allow read: if request\.auth != null;/u.test(rulesSource), false);
  assert.equal(/match \/communityRoomReads\/\{readId\} \{\s*allow read: if request\.auth != null;/u.test(rulesSource), false);
  assert.match(rulesSource, /match \/communityRooms\/\{roomId\} \{\s*allow read: if canReadCommunity\(\)/u);
  assert.match(rulesSource, /match \/communityRoomReads\/\{readId\} \{\s*allow read: if currentCommunityRulesAccepted\(\)/u);
});

test('die Community-Queries im Client bleiben so eingeschränkt, wie die Rules es verlangen', () => {
  const communityScreenSource = readFileSync('/workspaces/AffairGo/screens/CommunityScreen.js', 'utf8');

  assert.match(communityScreenSource, /collection\(db, 'communityRooms'\), where\('active', '==', true\)/u);
  assert.match(communityScreenSource, /collection\(db, 'communityRoomReads'\), where\('userId', '==', currentUser\.id\)/u);
});
