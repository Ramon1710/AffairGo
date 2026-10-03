const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Produktionskonfiguration enthält keine feste Admin-E-Mail oder festes Admin-Passwort im Clientkontext', () => {
  const contextSource = fs.readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');
  const appJson = fs.readFileSync('/workspaces/AffairGo/app.json', 'utf8');

  assert.doesNotMatch(contextSource, /ramon\.meyer/u);
  assert.doesNotMatch(contextSource, /heihachi/u);
  assert.doesNotMatch(appJson, /ramon\.meyer|heihachi/u);
});

test('Fehlendes Firestore-Nutzerdokument erzeugt kein lokales Adminprofil', () => {
  const contextSource = fs.readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');

  assert.doesNotMatch(contextSource, /__profileLookup !== 'found'[\s\S]*admin/u);
  assert.doesNotMatch(contextSource, /profileData = buildFixedAdminProfile/u);
});

test('Browser-Cache verleiht keine Adminrolle', () => {
  const contextSource = fs.readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');

  assert.match(contextSource, /hydrateAuthenticatedSession\(cachedSession, credentials\.user, \{ trustAdminMetadata: false \}\)/u);
  assert.match(contextSource, /hydrateAuthenticatedSession\(cachedSession, firebaseUser, \{ trustAdminMetadata: false \}\)/u);
});

test('Normale Nutzer können keine Adminrolle clientseitig setzen', () => {
  const contextSource = fs.readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');

  assert.match(contextSource, /delete sanitized\.isAdmin;/u);
  assert.match(contextSource, /delete sanitized\.role;/u);
});

test('Test- und Emulatorlogik lebt außerhalb des auslieferbaren Client-Logins', () => {
  const contextSource = fs.readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');
  const functionsDates = fs.readFileSync('/workspaces/AffairGo/functions/test/dates.test.js', 'utf8');

  assert.doesNotMatch(contextSource, /FIXED_ADMIN|buildFixedAdminProfile|matchesFixedAdminCredentials|isFixedAdmin/u);
  assert.match(functionsDates, /isAdmin: true/u);
});

test('Profilfoto-Gate ist unabhängig von Adminrechten', () => {
  const stackSource = fs.readFileSync('/workspaces/AffairGo/naviagtion/StackNavigator.js', 'utf8');

  assert.match(stackSource, /PROFILE_PHOTO_REQUIRED_ROUTES/u);
  assert.match(stackSource, /!hasProfilePhoto/u);
  assert.doesNotMatch(stackSource, /isAdmin/u);
});