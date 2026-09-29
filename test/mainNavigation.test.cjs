const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAIN_NAV_ITEMS,
  MAIN_NAV_DESKTOP_BREAKPOINT,
  getMainNavRouteName,
  isDesktopMainNavigation,
  isMainNavRootRoute,
} = require('../untils/mainNavigation');

test('die Hauptnavigation enthält genau sechs Punkte in der geforderten Reihenfolge', () => {
  assert.deepEqual(
    MAIN_NAV_ITEMS.map((item) => item.label),
    ['Aktuelles', 'Kennenlernen', 'Matching\nMap', 'Chats', 'Rooms', 'Profil'],
  );
});

test('untergeordnete Routen werden auf den richtigen Haupttab abgebildet', () => {
  assert.equal(getMainNavRouteName('Dashboard'), 'Dashboard');
  assert.equal(getMainNavRouteName('Explore'), 'Explore');
  assert.equal(getMainNavRouteName('MatchingMap'), 'MatchingMap');
  assert.equal(getMainNavRouteName('Chat'), 'Chat');
  assert.equal(getMainNavRouteName('CommunityRoom'), 'Community');
  assert.equal(getMainNavRouteName('CommunityModeration'), 'Community');
  assert.equal(getMainNavRouteName('Event'), 'Explore');
  assert.equal(getMainNavRouteName('Swipe'), 'Explore');
  assert.equal(getMainNavRouteName('Profil'), 'Profil');
});

test('nur die sechs Root-Routen gelten als direkte Haupttabs', () => {
  assert.equal(isMainNavRootRoute('Dashboard'), true);
  assert.equal(isMainNavRootRoute('Explore'), true);
  assert.equal(isMainNavRootRoute('MatchingMap'), true);
  assert.equal(isMainNavRootRoute('Chat'), true);
  assert.equal(isMainNavRootRoute('Community'), true);
  assert.equal(isMainNavRootRoute('Profil'), true);
  assert.equal(isMainNavRootRoute('CommunityRoom'), false);
  assert.equal(isMainNavRootRoute('Event'), false);
});

test('der Desktop-Breakpoint der Hauptnavigation bleibt zentral bei 960 Pixeln auf Web', () => {
  assert.equal(MAIN_NAV_DESKTOP_BREAKPOINT, 960);
  assert.equal(isDesktopMainNavigation(959, 'web'), false);
  assert.equal(isDesktopMainNavigation(960, 'web'), true);
  assert.equal(isDesktopMainNavigation(1280, 'web'), true);
  assert.equal(isDesktopMainNavigation(1280, 'ios'), false);
});