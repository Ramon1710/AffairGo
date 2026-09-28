import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AffairGoProvider } from './context/AffairGoContext';
import { NavigationProvider } from './naviagtion/SimpleNavigation';
import StackNavigator from './naviagtion/StackNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AffairGoProvider>
        <NavigationProvider initialRouteName="Landing">
          <StackNavigator />
        </NavigationProvider>
      </AffairGoProvider>
    </SafeAreaProvider>
  );
}
