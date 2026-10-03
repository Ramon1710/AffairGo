import { Component, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, EmptyState, ScreenHeader } from '../components/AffairGoUI';
import MainBottomNavigation from '../components/MainBottomNavigation';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { auth } from '../firebase';
import { getMainNavRouteName } from '../untils/mainNavigation';
import { useCurrentRoute, useNavigation } from './SimpleNavigation';

import ChatScreen from '../screens/ChatScreen';
import CommunityModerationScreen from '../screens/CommunityModerationScreen';
import CommunityRoomScreen from '../screens/CommunityRoomScreen';
import CommunityScreen from '../screens/CommunityScreen';
import Dashboard from '../screens/Dashboard';
import EventScreen from '../screens/EventScreen';
import ExploreScreen from '../screens/ExploreScreen';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import MatchingMapScreen from '../screens/MatchingMapScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ProfilScreen from '../screens/ProfilScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SwipeScreen from '../screens/SwipeScreen';
import TravelPlannerScreen from '../screens/TravelPlannerScreen';

const screens = {
  Landing: LandingScreen,
  Login: LoginScreen,
  Register: RegisterScreen,
  Onboarding: OnboardingScreen,
  Dashboard,
  Profil: ProfilScreen,
  MatchingMap: MatchingMapScreen,
  Swipe: SwipeScreen,
  Chat: ChatScreen,
  Community: CommunityScreen,
  CommunityRoom: CommunityRoomScreen,
  CommunityModeration: CommunityModerationScreen,
  Event: EventScreen,
  Explore: ExploreScreen,
  TravelPlanner: TravelPlannerScreen,
};

const PUBLIC_ROUTES = new Set(['Landing', 'Login', 'Register']);
const PROFILE_PHOTO_REQUIRED_ROUTES = new Set(['MatchingMap', 'Swipe']);

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <AppBackground>
        <ScreenHeader title="Ansicht vorübergehend nicht verfügbar" subtitle="Night Whisper" />
        <EmptyState
          title="Dieser Bereich konnte gerade nicht geöffnet werden."
          detail="Bitte versuche es erneut oder gehe zurück zur vorherigen Übersicht."
          action={<AccentButton label="Ansicht neu laden" onPress={this.props.onRetry} />}
        />
      </AppBackground>
    );
  }
}

const StackNavigator = () => {
  const navigation = useNavigation();
  const route = useCurrentRoute();
  const { currentUser, isAuthenticated, isAuthReady } = useAffairGo();
  const [routeErrorResetKey, setRouteErrorResetKey] = useState(0);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    const hasFirebaseSession = Boolean(auth.currentUser);
    const hasActiveSession = isAuthenticated || hasFirebaseSession;
    const hasCompletedOnboarding = Boolean(currentUser.onboardingCompleted || currentUser.preferences?.length);
    const hasProfilePhoto = Boolean(currentUser.profilePhotoUrl || currentUser.profileImageUri);
    const nextAuthenticatedRoute = hasCompletedOnboarding ? 'Dashboard' : 'Onboarding';
    const isPublicRoute = PUBLIC_ROUTES.has(route.name);

    if (hasActiveSession && isPublicRoute) {
      navigation.reset({ index: 0, routes: [{ name: nextAuthenticatedRoute }] });
      return;
    }

    if (hasActiveSession && PROFILE_PHOTO_REQUIRED_ROUTES.has(route.name) && !hasProfilePhoto) {
      navigation.reset({ index: 0, routes: [{ name: 'Profil' }] });
      return;
    }

    if (!hasActiveSession && !isPublicRoute) {
      navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
    }
  }, [currentUser.onboardingCompleted, currentUser.preferences, currentUser.profilePhotoUrl, currentUser.profileImageUri, isAuthenticated, isAuthReady, navigation, route.name]);

  if (!isAuthReady) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={affairGoTheme.colors.accent} />
        <Text style={styles.loadingText}>Session wird wiederhergestellt...</Text>
      </View>
    );
  }

  const ActiveScreen = screens[route.name] || LandingScreen;
  const showMainNavigation = Boolean(isAuthenticated && getMainNavRouteName(route.name));
  const routeResetKey = `${route.name}:${JSON.stringify(route.params || {})}:${routeErrorResetKey}`;

  return (
    <View style={styles.appFrame}>
      <RouteErrorBoundary resetKey={routeResetKey} onRetry={() => setRouteErrorResetKey((previous) => previous + 1)}>
        <ActiveScreen />
      </RouteErrorBoundary>
      {showMainNavigation ? <MainBottomNavigation /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: affairGoTheme.colors.background,
    paddingHorizontal: 24,
  },
  appFrame: {
    flex: 1,
    backgroundColor: affairGoTheme.colors.background,
  },
  loadingText: {
    marginTop: 14,
    color: affairGoTheme.colors.text,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default StackNavigator;
