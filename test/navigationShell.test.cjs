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
  assert.match(source, /CommunityRoom: '\/community\/room'/);
  assert.match(source, /TravelPlanner: '\/reiseplaner'/);
  assert.match(source, /'\/reiseplaner': 'TravelPlanner'/);
});

test('Matching Map und Swipe bleiben am Profilfoto-Gate und leiten auf Profil um', () => {
  const stackSource = fs.readFileSync('/workspaces/AffairGo/naviagtion/StackNavigator.js', 'utf8');

  assert.match(stackSource, /const PROFILE_PHOTO_REQUIRED_ROUTES = new Set\(\['MatchingMap', 'Swipe'\]\)/u);
  assert.match(stackSource, /navigation\.reset\(\{ index: 0, routes: \[\{ name: 'Profil' \}\] \}\);/u);
  assert.doesNotMatch(stackSource, /isAdmin/u);
});

test('Produktionscode enthält keine feste Admin-Sonderanmeldung oder lokale privilegierte Admin-Hydrierung', () => {
  const contextSource = fs.readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');

  assert.doesNotMatch(contextSource, /FIXED_ADMIN/u);
  assert.doesNotMatch(contextSource, /isFixedAdmin/u);
  assert.doesNotMatch(contextSource, /matchesFixedAdminCredentials/u);
  assert.doesNotMatch(contextSource, /buildFixedAdminProfile/u);
  assert.doesNotMatch(contextSource, /Admin-Login/u);
});

test('Hydrierte Sessions werden sofort in den Browser-Cache geschrieben, ohne lokale Adminrechte aus dem Cache zu vertrauen', () => {
  const contextSource = fs.readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');

  assert.match(contextSource, /const normalizedChats = normalizeStoredChats\(sessionData\?\.chats\);/u);
  assert.match(contextSource, /writeCachedSession\(normalizedProfile\.id, \{/u);
  assert.match(contextSource, /dismissedProfileIds: normalizedDismissedProfiles,/u);
  assert.match(contextSource, /hydrateAuthenticatedSession\(cachedSession, credentials\.user, \{ trustAdminMetadata: false \}\)/u);
});

test('Servergeladene Profile sind die einzige Clientquelle für Adminrechte', () => {
  const contextSource = fs.readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');

  assert.match(contextSource, /const trustedAdmin = trustAdminMetadata && \(profile\.isAdmin === true \|\| profile\.role === 'admin'\);/u);
  assert.match(contextSource, /hydrateAuthenticatedSession\(profileData, credentials\.user, \{\s*trustAdminMetadata: profileData\.__profileLookup === 'found'/u);
  assert.match(contextSource, /role: trustedAdmin \? 'admin' : defaults\.role,/u);
  assert.match(contextSource, /isAdmin: trustedAdmin,/u);
});

test('Clientseitige Profilspeicherung entfernt Adminfelder aus schreibbaren Payloads', () => {
  const contextSource = fs.readFileSync('/workspaces/AffairGo/context/AffairGoContext.js', 'utf8');

  assert.match(contextSource, /delete sanitized\.isAdmin;/u);
  assert.match(contextSource, /delete sanitized\.role;/u);
});

test('App-Konfiguration verwendet das hochgeladene ICON_Night_Whisper und eine getrennte Android-Foreground-Datei', () => {
  const appJson = fs.readFileSync('/workspaces/AffairGo/app.json', 'utf8');

  assert.match(appJson, /"icon": "\.\/assets\/branding\/ICON_Night_Whisper\.png"/u);
  assert.match(appJson, /"foregroundImage": "\.\/assets\/branding\/ICON_Night_Whisper-foreground\.png"/u);
  assert.match(appJson, /"favicon": "\.\/assets\/branding\/ICON_Night_Whisper\.png"/u);
  assert.match(appJson, /"ios": \{[\s\S]*"icon": "\.\/assets\/branding\/ICON_Night_Whisper\.png"/u);
});

test('Community-Navigation fängt Renderfehler mit einer bestehenden Fallback-Ansicht ab', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/naviagtion/StackNavigator.js', 'utf8');

  assert.match(source, /class RouteErrorBoundary extends Component/u);
  assert.match(source, /<EmptyState/u);
  assert.match(source, /title="Dieser Bereich konnte gerade nicht geöffnet werden\."/u);
  assert.match(source, /label="Ansicht neu laden"/u);
  assert.ok(source.includes('<RouteErrorBoundary resetKey={routeResetKey} onRetry={() => setRouteErrorResetKey((previous) => previous + 1)}>'));
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
  const matchesSection = source.split('const renderMatches = () => {')[1].split('const renderDates = () => {')[0];
  const datesSection = source.split('const renderDates = () => {')[1].split('const renderEvents = () => {')[0];
  const eventsSection = source.split('const renderEvents = () => {')[1].split('return (')[0];

  assert.match(source, /const SEGMENTS = \['matches', 'dates', 'events'\]/);
  assert.match(source, /createDate, listDates, toggleDateInterest, updateDate/);
  assert.match(source, /handleCancelDate/);
  assert.match(source, /Interesse bekunden/);
  assert.match(source, /Zum Event-Room/);
  assert.match(source, /flexWrap: 'nowrap'/);
  assert.match(source, /segmentButtonLabelCompact/);
  assert.match(datesSection, /label="\+ Date erstellen"/);
  assert.match(eventsSection, /label="\+ Event erstellen"/);
  assert.equal(/Date erstellen|Event erstellen/u.test(matchesSection), false);
});