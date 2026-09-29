const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Hauptnavigation rendert mobil unten und auf Desktop oben mit derselben Routenliste', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/components/MainBottomNavigation.js', 'utf8');
  const navSource = fs.readFileSync('/workspaces/AffairGo/untils/mainNavigation.js', 'utf8');

  assert.match(source, /MAIN_NAV_ITEMS\.map/);
  assert.match(source, /const isDesktop = isDesktopMainNavigation\(width, Platform\.OS\)/);
  assert.match(source, /const isCompactDesktop = isDesktop && width < 1100/);
  assert.match(source, /const isWideDesktop = isDesktop && width >= 1280/);
  assert.match(source, /styles\.overlayDesktop/);
  assert.match(source, /<NightWhisperLogo height=\{isCompactDesktop \? 34 : 38\} \/>/);
  assert.match(navSource, /main-nav-aktuelles/);
  assert.match(navSource, /main-nav-kennenlernen/);
  assert.match(navSource, /main-nav-matching-map/);
  assert.match(navSource, /main-nav-chats/);
  assert.match(navSource, /main-nav-rooms/);
  assert.match(navSource, /main-nav-profil/);
  assert.match(source, /numberOfLines=\{2\}/);
  assert.match(source, /size=\{isWideDesktop \? 30 : isCompactDesktop \? 26 : 28\}/);
  assert.match(source, /styles\.itemDesktop/);
  assert.match(source, /styles\.itemActiveDesktop/);
  assert.match(source, /\{item\.label\}/);
  assert.match(source, /<Ionicons name=\{iconName\}/);
});

test('SimpleNavigation behält Browser-History und Popstate-Sync für Web bei', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/naviagtion/SimpleNavigation.js', 'utf8');

  assert.match(source, /window\.addEventListener\('popstate', syncRouteFromBrowser\)/);
  assert.match(source, /window\.history\.pushState\(/);
  assert.match(source, /currentStack\.slice\(0, -1\)/);
});

test('AppBackground berücksichtigt Safe Area sowie Desktop-Topabstand statt Desktop-Bottomabstand', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/components/AffairGoUI.js', 'utf8');
  const navSource = fs.readFileSync('/workspaces/AffairGo/untils/mainNavigation.js', 'utf8');

  assert.match(source, /useSafeAreaInsets/);
  assert.match(source, /bottomNavigationSpace/);
  assert.match(source, /topNavigationSpace/);
  assert.match(source, /contentTopPadding/);
  assert.match(source, /MAIN_NAV_DESKTOP_BAR_HEIGHT/);
  assert.match(source, /MAIN_NAV_MOBILE_BAR_HEIGHT/);
  assert.match(source, /isDesktopMainNavigation/);
  assert.match(navSource, /const MAIN_NAV_DESKTOP_BAR_HEIGHT = 94/);
});

test('Aktuelles zeigt die Profilkarte nur unter 100 Prozent und öffnet Matches mit Online-Filter', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/Dashboard.js', 'utf8');

  assert.match(source, /!profileCompletion\.isComplete/);
  assert.match(source, /navigation\.navigate\('Explore', \{ segment: 'matches', filter \}\)/);
  assert.match(source, /profile-status-card/);
});

test('Kennenlernen enthält Matches, Dates und Events inklusive Dates-Callables', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/ExploreScreen.js', 'utf8');

  assert.match(source, /const SEGMENTS = \['matches', 'dates', 'events'\]/);
  assert.match(source, /createDate, listDates, toggleDateInterest, updateDate/);
  assert.match(source, /handleCancelDate/);
  assert.match(source, /Interesse bekunden/);
  assert.match(source, /Zum Event-Room/);
});