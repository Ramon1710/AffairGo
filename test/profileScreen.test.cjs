const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Profilscreen zeigt Sternzeichen und Profil-Vollständigkeit auf Basis der bestehenden Helper an', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/ProfilScreen.js', 'utf8');

  assert.match(source, /import \{ getProfileCompletionState \} from '\.\.\/untils\/profileStatus';/u);
  assert.match(source, /const getZodiacLabel = \(profile\) => \{/u);
  assert.match(source, /<Text style=\{styles\.groupTitle\}>Profil-Vollständigkeit<\/Text>/u);
  assert.match(source, /label=\{`\$\{profileCompletion\.percent\}% vollständig`\}/u);
  assert.match(source, /Sternzeichen/u);
});

test('Profilscreen prüft zuerst, ob ein Fremdprofil vorhanden ist, bevor profilabhängige Labels berechnet werden', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/ProfilScreen.js', 'utf8');
  const profileBlock = source.match(/const profile = isOwnProfile \? draft : viewedProfile;[\s\S]*?const profileCompletion = getProfileCompletionState\(profile\);/u)?.[0] || '';

  assert.match(profileBlock, /if \(!profile\) \{\s+return null;\s+\}/u);
  assert.match(profileBlock, /const verificationTone = profile\.verificationState/u);
  assert.ok(profileBlock.indexOf('if (!profile)') < profileBlock.indexOf('const verificationTone = profile.verificationState'));
});

test('Profilscreen registriert Screen-Capture-Hooks vor dem möglichen Null-Return', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/ProfilScreen.js', 'utf8');

  assert.match(source, /useEffect\(\(\) => \{\s+preventScreenCaptureAsync\(\)\.catch\(\(\) => undefined\);/u);
  assert.ok(source.indexOf('preventScreenCaptureAsync') < source.indexOf('if (!profile) {'));
  assert.ok(source.indexOf('allowScreenCaptureAsync') < source.indexOf('if (!profile) {'));
});

test('Profilscreen gruppiert Eigendaten neu und blendet leere Fremdprofil-Galerien aus', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/ProfilScreen.js', 'utf8');

  assert.match(source, /<Text style=\{styles\.groupTitle\}>Persönlich<\/Text>/u);
  assert.match(source, /<Text style=\{styles\.groupTitle\}>Aussehen<\/Text>/u);
  assert.match(source, /<Text style=\{styles\.groupTitle\}>Suche<\/Text>/u);
  assert.match(source, /const shouldShowGallery = isOwnProfile \|\| galleryItems\.length > 0;/u);
  assert.match(source, /buildProfileFactRows/u);
  assert.match(source, /navigation\.navigate\('Chat', \{ userId: profile\.id \}\)/u);
});

test('Profilscreen verlinkt Urlaub und Dienstreise auf den bestehenden Reiseplaner mit mode-Parametern', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/ProfilScreen.js', 'utf8');

  assert.match(source, /label="Urlaub"/u);
  assert.match(source, /label="Dienstreise"/u);
  assert.match(source, /navigation\.navigate\('TravelPlanner', \{ mode: 'vacation' \}\)/u);
  assert.match(source, /navigation\.navigate\('TravelPlanner', \{ mode: 'business' \}\)/u);
  assert.match(source, /Die vorhandene Reiseplanung bleibt die zentrale Quelle für Dashboard und Matching Map\./u);
  assert.match(source, /\{isOwnProfile \? \(\s*<View style=\{styles\.travelActionRow\}>/u);
});