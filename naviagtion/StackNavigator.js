import { useCurrentRoute } from './SimpleNavigation';

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

const StackNavigator = () => {
  const route = useCurrentRoute();
  const ActiveScreen = screens[route.name] || LandingScreen;

  return <ActiveScreen />;
};

export default StackNavigator;
