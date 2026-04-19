import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Dashboard from '../screens/Dashboard';
import LoginScreen from '../screens/LoginScreen';
import ProfilScreen from '../screens/ProfilScreen';
import RegisterScreen from '../screens/RegisterScreen';

// Weitere Screens (noch leer oder folgen später)
import ChatScreen from '../screens/ChatScreen';
import EventScreen from '../screens/EventScreen';
import ExploreScreen from '../screens/ExploreScreen';
import MatchingMapScreen from '../screens/MatchingMapScreen';
import SwipeScreen from '../screens/SwipeScreen';

const Stack = createNativeStackNavigator();

const StackNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Dashboard" component={Dashboard} />
      <Stack.Screen name="Profil" component={ProfilScreen} />
      <Stack.Screen name="MatchingMap" component={MatchingMapScreen} />
      <Stack.Screen name="Swipe" component={SwipeScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Event" component={EventScreen} />
      <Stack.Screen name="Explore" component={ExploreScreen} />
    </Stack.Navigator>
  );
};

export default StackNavigator;
