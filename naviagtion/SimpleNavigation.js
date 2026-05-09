import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

const NavigationContext = createContext(null);

export const NavigationProvider = ({ initialRouteName = 'Landing', children }) => {
  const [stack, setStack] = useState([{ name: initialRouteName, params: undefined }]);
  const stackRef = useRef(stack);

  const currentRoute = stack[stack.length - 1] || { name: initialRouteName, params: undefined };

  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stackRef.current.length > 1) {
        setStack((previous) => previous.slice(0, -1));
      }

      return true;
    });

    return () => {
      backSubscription.remove();
    };
  }, []);

  const navigation = useMemo(
    () => ({
      navigate: (name, params) => {
        setStack((previous) => [...previous, { name, params }]);
      },
      canGoBack: () => stack.length > 1,
      goBack: () => {
        setStack((previous) => (previous.length > 1 ? previous.slice(0, -1) : previous));
      },
      reset: ({ routes, index = 0 }) => {
        const nextRoutes = (routes || []).map((route) => ({ name: route.name, params: route.params }));
        if (!nextRoutes.length) {
          return;
        }
        const safeIndex = Math.min(Math.max(index, 0), nextRoutes.length - 1);
        setStack(nextRoutes.slice(0, safeIndex + 1));
      },
      replace: (name, params) => {
        setStack((previous) => {
          if (!previous.length) {
            return [{ name, params }];
          }
          return [...previous.slice(0, -1), { name, params }];
        });
      },
    }),
    [stack.length]
  );

  const value = useMemo(() => ({ navigation, route: currentRoute }), [navigation, currentRoute]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation muss innerhalb von NavigationProvider verwendet werden.');
  }
  return context.navigation;
};

export const useRoute = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useRoute muss innerhalb von NavigationProvider verwendet werden.');
  }
  return context.route;
};

export const useCurrentRoute = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useCurrentRoute muss innerhalb von NavigationProvider verwendet werden.');
  }
  return context.route;
};