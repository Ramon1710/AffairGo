import { NavigationContainer } from '@react-navigation/native';
import { AffairGoProvider } from './context/AffairGoContext';
import StackNavigator from './naviagtion/StackNavigator';

export default function App() {
  return (
    <AffairGoProvider>
      <NavigationContainer>
        <StackNavigator />
      </NavigationContainer>
    </AffairGoProvider>
  );
}
