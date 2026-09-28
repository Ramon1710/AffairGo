import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { db } from '../firebase';
import { useCurrentRoute, useNavigation } from '../naviagtion/SimpleNavigation';
import { Ionicons } from './SimpleIcons';

const {
  getCommunityUnreadRoomsCount,
  normalizeCommunityRoom,
  normalizeCommunityRoomRead,
} = require('../untils/communityChat');
const {
  MAIN_NAV_ITEMS,
  MAIN_NAV_DESKTOP_BAR_HEIGHT,
  MAIN_NAV_MOBILE_BAR_HEIGHT,
  getMainNavRouteName,
} = require('../untils/mainNavigation');

const clampBadgeValue = (count = 0) => {
  const numericCount = Number.isFinite(Number(count)) ? Number(count) : 0;

  if (numericCount <= 0) {
    return '';
  }

  return numericCount > 99 ? '99+' : String(numericCount);
};

const MainBottomNavigation = () => {
  const navigation = useNavigation();
  const route = useCurrentRoute();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { chats, currentUser, isAuthenticated } = useAffairGo();
  const [communityRooms, setCommunityRooms] = useState([]);
  const [communityReads, setCommunityReads] = useState([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const activeRouteName = getMainNavRouteName(route.name);
  const isDesktop = Platform.OS === 'web' && width >= 960;
  const isCompactMobile = !isDesktop && width <= 390;
  const chatUnreadCount = useMemo(
    () => chats.reduce((sum, chat) => sum + Math.max(0, Number(chat?.unreadCount) || 0), 0),
    [chats],
  );
  const unreadRoomsCount = useMemo(
    () => getCommunityUnreadRoomsCount(communityRooms, communityReads),
    [communityReads, communityRooms],
  );
  const badgeMap = useMemo(
    () => ({
      Chat: clampBadgeValue(chatUnreadCount),
      Community: clampBadgeValue(unreadRoomsCount),
    }),
    [chatUnreadCount, unreadRoomsCount],
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setCommunityRooms([]);
      return undefined;
    }

    const roomsQuery = query(collection(db, 'communityRooms'), where('active', '==', true));
    const unsubscribe = onSnapshot(roomsQuery, (snapshot) => {
      setCommunityRooms(snapshot.docs.map((roomDoc) => normalizeCommunityRoom({ id: roomDoc.id, ...roomDoc.data() }, roomDoc.id)));
    }, () => {
      setCommunityRooms([]);
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) {
      setCommunityReads([]);
      return undefined;
    }

    const readsQuery = query(collection(db, 'communityRoomReads'), where('userId', '==', currentUser.id));
    const unsubscribe = onSnapshot(readsQuery, (snapshot) => {
      setCommunityReads(snapshot.docs.map((readDoc) => normalizeCommunityRoomRead({ id: readDoc.id, ...readDoc.data() }, readDoc.id)));
    }, () => {
      setCommunityReads([]);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, isAuthenticated]);

  const handleTabPress = (item) => {
    if (!item?.routeName) {
      return;
    }

    if (activeRouteName === item.routeName && route.name !== item.routeName) {
      navigation.replace(item.routeName);
      return;
    }

    if (route.name === item.routeName) {
      return;
    }

    navigation.navigate(item.routeName);
  };

  if (!isAuthenticated || !activeRouteName || keyboardVisible) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View
        style={[
          styles.wrapper,
          isDesktop ? styles.wrapperDesktop : null,
          isCompactMobile ? styles.wrapperCompact : null,
          {
            paddingBottom: Math.max(insets.bottom, isDesktop ? 10 : 12),
          },
        ]}
      >
        <View
          style={[
            styles.bar,
            isDesktop ? styles.barDesktop : null,
            isCompactMobile ? styles.barCompact : null,
            { minHeight: isDesktop ? MAIN_NAV_DESKTOP_BAR_HEIGHT : MAIN_NAV_MOBILE_BAR_HEIGHT },
          ]}
        >
          {MAIN_NAV_ITEMS.map((item) => {
            const isActive = activeRouteName === item.routeName;
            const badgeValue = badgeMap[item.routeName] || '';
            const iconName = isActive ? item.activeIcon : item.icon;

            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => handleTabPress(item)}
                style={[styles.item, isCompactMobile ? styles.itemCompact : null, isActive ? styles.itemActive : null]}
                testID={item.testLabel}
              >
                {badgeValue ? (
                  <View style={[styles.badge, isCompactMobile ? styles.badgeCompact : null]}>
                    <Text style={styles.badgeText}>{badgeValue}</Text>
                  </View>
                ) : null}
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  numberOfLines={2}
                  maxFontSizeMultiplier={1.1}
                  style={[styles.label, isCompactMobile ? styles.labelCompact : null, isActive ? styles.labelActive : null]}
                >
                  {item.label}
                </Text>
                <Ionicons name={iconName} size={22} color={isActive ? affairGoTheme.colors.accent : affairGoTheme.colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  wrapper: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  wrapperDesktop: {
    paddingHorizontal: 24,
  },
  wrapperCompact: {
    paddingHorizontal: 8,
  },
  bar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: 'rgba(8, 11, 30, 0.96)',
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  barDesktop: {
    maxWidth: 720,
    paddingHorizontal: 10,
  },
  barCompact: {
    paddingHorizontal: 2,
  },
  item: {
    position: 'relative',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 22,
    gap: 5,
  },
  itemCompact: {
    paddingHorizontal: 2,
    paddingVertical: 7,
    gap: 4,
  },
  itemActive: {
    backgroundColor: 'rgba(118, 87, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(118, 87, 255, 0.22)',
  },
  label: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
    minHeight: 24,
  },
  labelCompact: {
    fontSize: 9,
    lineHeight: 11,
    minHeight: 22,
  },
  labelActive: {
    color: affairGoTheme.colors.accent,
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: affairGoTheme.colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(247, 245, 255, 0.18)',
  },
  badgeCompact: {
    right: 4,
  },
  badgeText: {
    color: affairGoTheme.colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
});

export default MainBottomNavigation;