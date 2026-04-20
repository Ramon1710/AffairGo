import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createStackNavigator } from '@react-navigation/stack';
import { Platform } from 'react-native';

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

const Stack = Platform.OS === 'web' ? createStackNavigator() : createNativeStackNavigator();

const StackNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="Landing" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Dashboard" component={Dashboard} />
      <Stack.Screen name="Profil" component={ProfilScreen} />
      <Stack.Screen name="MatchingMap" component={MatchingMapScreen} />
      <Stack.Screen name="Swipe" component={SwipeScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Event" component={EventScreen} />
      <Stack.Screen name="Explore" component={ExploreScreen} />
      <Stack.Screen name="TravelPlanner" component={TravelPlannerScreen} />
    </Stack.Navigator>
  );
};

export default StackNavigator;
