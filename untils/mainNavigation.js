const MAIN_NAV_ITEMS = Object.freeze([
  {
    key: 'aktuelles',
    label: 'Aktuelles',
    routeName: 'Dashboard',
    icon: 'sparkles-outline',
    activeIcon: 'sparkles',
    testLabel: 'main-nav-aktuelles',
  },
  {
    key: 'kennenlernen',
    label: 'Kennenlernen',
    routeName: 'Explore',
    icon: 'heart-outline',
    activeIcon: 'heart',
    testLabel: 'main-nav-kennenlernen',
  },
  {
    key: 'matching-map',
    label: 'Matching\nMap',
    routeName: 'MatchingMap',
    icon: 'map-outline',
    activeIcon: 'map',
    testLabel: 'main-nav-matching-map',
  },
  {
    key: 'chats',
    label: 'Chats',
    routeName: 'Chat',
    icon: 'chatbubbles-outline',
    activeIcon: 'chatbubbles',
    testLabel: 'main-nav-chats',
  },
  {
    key: 'rooms',
    label: 'Rooms',
    routeName: 'Community',
    icon: 'people-outline',
    activeIcon: 'people',
    testLabel: 'main-nav-rooms',
  },
  {
    key: 'profil',
    label: 'Profil',
    routeName: 'Profil',
    icon: 'person-outline',
    activeIcon: 'person',
    testLabel: 'main-nav-profil',
  },
]);

const MAIN_NAV_MOBILE_BAR_HEIGHT = 86;
const MAIN_NAV_DESKTOP_BAR_HEIGHT = 78;
const MAIN_NAV_DESKTOP_BREAKPOINT = 960;

const MAIN_NAV_ROUTE_GROUPS = Object.freeze({
  Dashboard: 'Dashboard',
  Explore: 'Explore',
  MatchingMap: 'MatchingMap',
  Chat: 'Chat',
  Community: 'Community',
  CommunityRoom: 'Community',
  CommunityModeration: 'Community',
  Profil: 'Profil',
  Swipe: 'Explore',
  Event: 'Explore',
  TravelPlanner: 'Dashboard',
});

const getMainNavRouteName = (routeName = '') => MAIN_NAV_ROUTE_GROUPS[String(routeName || '').trim()] || '';

const isMainNavRoute = (routeName = '') => Boolean(getMainNavRouteName(routeName));

const isMainNavRootRoute = (routeName = '') => MAIN_NAV_ITEMS.some((item) => item.routeName === routeName);

const isDesktopMainNavigation = (width = 0, platform = '') => platform === 'web' && Number(width) >= MAIN_NAV_DESKTOP_BREAKPOINT;

module.exports = {
  MAIN_NAV_ITEMS,
  MAIN_NAV_MOBILE_BAR_HEIGHT,
  MAIN_NAV_DESKTOP_BAR_HEIGHT,
  MAIN_NAV_DESKTOP_BREAKPOINT,
  MAIN_NAV_ROUTE_GROUPS,
  getMainNavRouteName,
  isDesktopMainNavigation,
  isMainNavRoute,
  isMainNavRootRoute,
};