import { useCurrentRoute } from './SimpleNavigation';

import Dashboard from '../screens/Dashboard';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ProfilScreen from '../screens/ProfilScreen';
import RegisterScreen from '../screens/RegisterScreen';
import TravelPlannerScreen from '../screens/TravelPlannerScreen';
import ChatScreen from '../screens/ChatScreen';
import EventScreen from '../screens/EventScreen';
import ExploreScreen from '../screens/ExploreScreen';
import MatchingMapScreen from '../screens/MatchingMapScreen';
import SwipeScreen from '../screens/SwipeScreen';

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

const StackNavigator = () => {
  const route = useCurrentRoute();
  const ActiveScreen = screens[route.name] || LandingScreen;

  return <ActiveScreen />;
};

export default StackNavigator;
