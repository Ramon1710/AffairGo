import 'react-native-gesture-handler';
import { AffairGoProvider } from './context/AffairGoContext';
import { NavigationProvider } from './naviagtion/SimpleNavigation';
import StackNavigator from './naviagtion/StackNavigator';

export default function App() {
  return (
    <AffairGoProvider>
      <NavigationProvider initialRouteName="Landing">
        <StackNavigator />
      </NavigationProvider>
    </AffairGoProvider>
  );
}
