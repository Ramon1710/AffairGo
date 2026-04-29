import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { useCurrentRoute, useNavigation } from './SimpleNavigation';

import ChatScreen from '../screens/ChatScreen';
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
  Event: EventScreen,
  Explore: ExploreScreen,
  TravelPlanner: TravelPlannerScreen,
};

const PUBLIC_ROUTES = new Set(['Landing', 'Login', 'Register']);

const StackNavigator = () => {
  const navigation = useNavigation();
  const route = useCurrentRoute();
  const { currentUser, isAuthenticated, isAuthReady } = useAffairGo();

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    const nextAuthenticatedRoute = currentUser.onboardingCompleted ? 'Dashboard' : 'Onboarding';
    const isPublicRoute = PUBLIC_ROUTES.has(route.name);

    if (isAuthenticated && isPublicRoute) {
      navigation.reset({ index: 0, routes: [{ name: nextAuthenticatedRoute }] });
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
    }
  }, [currentUser.onboardingCompleted, isAuthenticated, isAuthReady, navigation, route.name]);

  if (!isAuthReady) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={affairGoTheme.colors.accent} />
        <Text style={styles.loadingText}>Session wird wiederhergestellt...</Text>
      </View>
    );
  }

  const ActiveScreen = screens[route.name] || LandingScreen;

  return <ActiveScreen />;
};

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: affairGoTheme.colors.background,
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 14,
    color: affairGoTheme.colors.text,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default StackNavigator;
